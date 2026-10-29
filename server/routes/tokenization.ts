import { Router } from 'express';
import { db } from '../db';
import { tokenizedSongs, tokenPurchases, artistTokenEarnings, users } from '../db/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createPublicClient, decodeEventLog, decodeFunctionData, fallback, formatEther, http, parseEther } from 'viem';
import { polygon } from 'viem/chains';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { generateImageWithNanoBanana } from '../services/fal-service';
import { PRIMARY_MODEL } from '../utils/ai-config';

const router = Router();

const tokenPurchaseAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'buyTokens', outputs: [], stateMutability: 'payable', type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'operator', type: 'address' },
      { indexed: true, internalType: 'address', name: 'from', type: 'address' },
      { indexed: true, internalType: 'address', name: 'to', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'id', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'TransferSingle', type: 'event',
  },
] as const;

const polygonClient = createPublicClient({
  chain: polygon,
  transport: fallback([
    http('https://polygon-bor-rpc.publicnode.com', { timeout: 15000, retryCount: 2 }),
    http('https://1rpc.io/matic', { timeout: 15000, retryCount: 2 }),
  ]),
});

async function verifyTokenPurchaseOnchain(input: {
  transactionHash: `0x${string}`;
  contractAddress: string;
  buyerWalletAddress: string;
  tokenId: number;
  amountTokens: number;
}) {
  const [receipt, transaction] = await Promise.all([
    polygonClient.getTransactionReceipt({ hash: input.transactionHash }),
    polygonClient.getTransaction({ hash: input.transactionHash }),
  ]);
  if (receipt.status !== 'success') throw new Error('The Polygon purchase transaction did not succeed.');
  if (transaction.chainId !== polygon.id) throw new Error('Purchase transaction must be confirmed on Polygon.');
  if (!transaction.to || transaction.to.toLowerCase() !== input.contractAddress.toLowerCase()) {
    throw new Error('Purchase transaction contract does not match the selected song.');
  }
  if (transaction.from.toLowerCase() !== input.buyerWalletAddress.toLowerCase()) {
    throw new Error('The transaction sender does not match the buyer wallet.');
  }

  const decoded = decodeFunctionData({ abi: tokenPurchaseAbi, data: transaction.input });
  if (decoded.functionName !== 'buyTokens') throw new Error('Transaction is not a token purchase.');
  const [tokenId, amount] = decoded.args;
  if (tokenId !== BigInt(input.tokenId) || amount !== BigInt(input.amountTokens)) {
    throw new Error('Transaction token and quantity do not match the purchase record.');
  }
  if (transaction.value <= 0n) throw new Error('The purchase transaction has no payment value.');

  const transferConfirmed = receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== input.contractAddress.toLowerCase()) return false;
    try {
      const parsed = decodeEventLog({ abi: tokenPurchaseAbi, data: log.data, topics: log.topics });
      return parsed.eventName === 'TransferSingle'
        && parsed.args.to.toLowerCase() === input.buyerWalletAddress.toLowerCase()
        && parsed.args.id === BigInt(input.tokenId)
        && parsed.args.value === BigInt(input.amountTokens);
    } catch { return false; }
  });
  if (!transferConfirmed) throw new Error('Polygon receipt does not confirm delivery of the purchased tokens.');
  return { blockNumber: Number(receipt.blockNumber), pricePaidEth: formatEther(transaction.value) };
}

const createTokenizedSongSchema = z.object({
  // When tokenizing for an AI artist owned by the logged user, the client
  // should pass the AI artist's user id here. If omitted, the song is
  // attributed to the logged user (legacy behavior, only valid for non-AI
  // artist accounts tokenizing their own music).
  artistId: z.number().int().positive().optional(),
  songName: z.string().min(1, "Song name is required"),
  songUrl: z.string().url().optional().nullable().or(z.literal('')),
  tokenSymbol: z.string().min(1, "Token symbol is required").max(20),
  totalSupply: z.number().int().positive(),
  pricePerTokenUsd: z.number().positive(),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address").default('0x0000000000000000000000000000000000000000'),
  metadataUri: z.string().url().optional().nullable().or(z.literal('')),
  imageUrl: z.string().url().optional().nullable().or(z.literal('')),
  description: z.string().optional().nullable().or(z.literal('')),
  benefits: z.array(z.string()).optional().nullable(),
  royaltyPercentageArtist: z.number().int().min(0).max(100).default(80),
  royaltyPercentagePlatform: z.number().int().min(0).max(100).default(20),
});

const recordPurchaseSchema = z.object({
  tokenizedSongId: z.number().int().positive(),
  buyerWalletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  amountTokens: z.number().int().positive(),
  pricePaidEth: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid ETH payment amount'),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
  blockNumber: z.number().int().positive().optional(),
});

// GET /api/tokenization/songs - Get songs for authenticated user
router.get('/songs', async (req, res) => {
  try {
    const clerkUser = req.user as any;
    if (!clerkUser || !clerkUser.id) {
      return res.json([]); // Return empty array if not authenticated
    }

    // Resolve Clerk string ID → numeric DB user ID
    const [dbUser] = await db.select({ id: users.id }).from(users)
      .where(eq(users.clerkId, clerkUser.id)).limit(1);
    if (!dbUser) return res.json([]);

    const songs = await db.select().from(tokenizedSongs)
      .where(eq(tokenizedSongs.artistId, dbUser.id))
      .orderBy(desc(tokenizedSongs.createdAt));

    res.json(songs);
  } catch (error) {
    console.error('Error fetching tokenized songs for user:', error);
    res.json([]); // Return empty array on error to prevent 500
  }
});

// GET /api/tokenization/earnings - Get earnings for authenticated user
router.get('/earnings', async (req, res) => {
  try {
    const clerkUser = req.user as any;
    if (!clerkUser || !clerkUser.id) {
      return res.json({ totalEarnings: 0, recentEarnings: [] });
    }

    // Resolve Clerk string ID → numeric DB user ID
    const [dbUser] = await db.select({ id: users.id }).from(users)
      .where(eq(users.clerkId, clerkUser.id)).limit(1);
    if (!dbUser) return res.json({ totalEarnings: 0, recentEarnings: [] });

    const earnings = await db.select().from(artistTokenEarnings)
      .where(eq(artistTokenEarnings.artistId, dbUser.id))
      .orderBy(desc(artistTokenEarnings.createdAt));

    const totalEarnings = earnings.reduce((sum, e) => sum + parseFloat(e.amountUsd || '0'), 0);

    res.json({ 
      totalEarnings, 
      recentEarnings: earnings.slice(0, 10) 
    });
  } catch (error) {
    console.error('Error fetching earnings for user:', error);
    res.json({ totalEarnings: 0, recentEarnings: [] });
  }
});

router.get('/songs/:artistId', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    if (isNaN(artistId)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    const songs = await db.select().from(tokenizedSongs)
      .where(eq(tokenizedSongs.artistId, artistId))
      .orderBy(desc(tokenizedSongs.createdAt));

    res.json(songs);
  } catch (error) {
    console.error('Error fetching tokenized songs:', error);
    res.status(500).json({ error: 'Failed to fetch tokenized songs' });
  }
});

router.get('/songs/active/:artistId', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    if (isNaN(artistId)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    const songs = await db.select().from(tokenizedSongs)
      .where(and(
        eq(tokenizedSongs.artistId, artistId),
        eq(tokenizedSongs.isActive, true)
      ))
      .orderBy(desc(tokenizedSongs.createdAt));

    res.json(songs);
  } catch (error) {
    console.error('Error fetching active tokenized songs:', error);
    res.status(500).json({ error: 'Failed to fetch active tokenized songs' });
  }
});

router.get('/song/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid song ID' });
    }

    const [song] = await db.select().from(tokenizedSongs)
      .where(eq(tokenizedSongs.id, id))
      .limit(1);

    if (!song) {
      return res.status(404).json({ error: 'Tokenized song not found' });
    }

    res.json(song);
  } catch (error) {
    console.error('Error fetching tokenized song:', error);
    res.status(500).json({ error: 'Failed to fetch tokenized song' });
  }
});

router.post('/create', async (req, res) => {
  let step = 'init';
  try {
    step = 'parse-body';
    const rawBody = req.body ?? {};
    console.log('🎵 [CREATE TOKEN] Datos recibidos:', JSON.stringify(rawBody, null, 2));
    console.log('🎵 [CREATE TOKEN] Usuario clerkId:', (req.user as any)?.id);

    step = 'zod-validate';
    const validatedData = createTokenizedSongSchema.parse(rawBody);
    console.log('✅ [CREATE TOKEN] Validación exitosa');

    step = 'auth-check';
    if (!req.user || !(req.user as any).id) {
      console.error('❌ [CREATE TOKEN] No autorizado - req.user:', req.user);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    step = 'resolve-db-user';
    const [dbUser] = await db.select({ id: users.id }).from(users)
      .where(eq(users.clerkId, (req.user as any).id)).limit(1);
    if (!dbUser) {
      console.error('❌ [CREATE TOKEN] DB user not found for clerkId:', (req.user as any).id);
      return res.status(401).json({ error: 'User not found' });
    }

    step = 'resolve-artist-id';
    let artistId = dbUser.id;
    if (validatedData.artistId && validatedData.artistId !== dbUser.id) {
      const [targetArtist] = await db.select({
        id: users.id,
        owner: users.generatedBy,
      }).from(users).where(eq(users.id, validatedData.artistId)).limit(1);

      if (!targetArtist) {
        return res.status(404).json({ error: 'Target artist not found' });
      }
      if (targetArtist.owner !== dbUser.id) {
        console.error('❌ [CREATE TOKEN] Unauthorized: user', dbUser.id, 'cannot tokenize for artist', targetArtist.id);
        return res.status(403).json({ error: 'Not authorized to tokenize for this artist' });
      }
      artistId = targetArtist.id;
    }
    console.log('✅ [CREATE TOKEN] Artist DB ID:', artistId, '(creator:', dbUser.id, ')');

    step = 'compute-token-id';
    const maxTokenId = await db.select({ max: sql<number>`COALESCE(MAX(${tokenizedSongs.tokenId}), 0)` })
      .from(tokenizedSongs);
    const nextTokenId = (maxTokenId[0]?.max || 0) + 1;

    step = 'sanitize-values';
    // Defensive: ensure no field that drizzle iterates is `undefined` (which can
    // trigger "Cannot convert undefined or null to object" inside ORM serializers).
    const totalSupplyNum = Number(validatedData.totalSupply);
    const priceNum = Number(validatedData.pricePerTokenUsd);
    if (!Number.isFinite(totalSupplyNum) || totalSupplyNum <= 0) {
      return res.status(400).json({ error: 'Validation error', message: 'totalSupply must be a positive number' });
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return res.status(400).json({ error: 'Validation error', message: 'pricePerTokenUsd must be a positive number' });
    }

    const benefitsArr: string[] | null = Array.isArray(validatedData.benefits) && validatedData.benefits.length > 0
      ? validatedData.benefits.filter((b): b is string => typeof b === 'string' && b.length > 0)
      : null;

    const insertValues = {
      artistId,
      songName: validatedData.songName,
      songUrl: validatedData.songUrl ? String(validatedData.songUrl) : null,
      tokenId: nextTokenId,
      tokenSymbol: validatedData.tokenSymbol,
      totalSupply: totalSupplyNum,
      availableSupply: totalSupplyNum,
      pricePerTokenUsd: priceNum.toFixed(2),
      contractAddress: validatedData.contractAddress || '0x0000000000000000000000000000000000000000',
      metadataUri: validatedData.metadataUri ? String(validatedData.metadataUri) : null,
      imageUrl: validatedData.imageUrl ? String(validatedData.imageUrl) : null,
      description: validatedData.description ? String(validatedData.description) : null,
      benefits: benefitsArr,
      royaltyPercentageArtist: Number(validatedData.royaltyPercentageArtist ?? 80),
      royaltyPercentagePlatform: Number(validatedData.royaltyPercentagePlatform ?? 20),
      isActive: true,
    };

    console.log('🎵 [CREATE TOKEN] Insert values:', JSON.stringify(insertValues, null, 2));

    step = 'db-insert';
    const inserted = await db.insert(tokenizedSongs).values(insertValues).returning();
    const newSong = inserted?.[0];
    if (!newSong) {
      console.error('❌ [CREATE TOKEN] Insert returned empty result');
      return res.status(500).json({ error: 'Failed to create tokenized song', message: 'Insert returned no rows' });
    }

    console.log('✅ [CREATE TOKEN] Canción creada exitosamente, id:', newSong.id);
    res.status(201).json(newSong);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ [CREATE TOKEN] Error de validación Zod:', JSON.stringify(error.errors, null, 2));
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
        message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }
    const err = error as any;
    console.error(`❌ [CREATE TOKEN] Error en step="${step}":`, err);
    console.error('❌ [CREATE TOKEN] Stack:', err?.stack);
    res.status(500).json({
      error: 'Failed to create tokenized song',
      step,
      message: err?.message || String(err),
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
      column: err?.column,
      table: err?.table,
    });
  }
});

router.post('/purchase/record', async (req, res) => {
  try {
    const validatedData = recordPurchaseSchema.parse(req.body);

    const [song] = await db.select().from(tokenizedSongs)
      .where(eq(tokenizedSongs.id, validatedData.tokenizedSongId))
      .limit(1);

    if (!song) return res.status(404).json({ error: 'Tokenized song not found' });
    const onchain = await verifyTokenPurchaseOnchain({
      transactionHash: validatedData.transactionHash as `0x${string}`,
      contractAddress: song.contractAddress,
      buyerWalletAddress: validatedData.buyerWalletAddress,
      tokenId: song.tokenId,
      amountTokens: validatedData.amountTokens,
    });
    if (parseEther(validatedData.pricePaidEth) !== parseEther(onchain.pricePaidEth)) {
      return res.status(400).json({ error: 'Submitted ETH amount does not match the confirmed Polygon transaction.' });
    }

    const pricePaidEth = Number(onchain.pricePaidEth);
    const artistEarnings = pricePaidEth * (song.royaltyPercentageArtist / 100);
    const platformEarnings = pricePaidEth * (song.royaltyPercentagePlatform / 100);
    const numericBuyerId = Number((req.user as any)?.id);
    const buyerUserId = Number.isInteger(numericBuyerId) && numericBuyerId > 0 ? numericBuyerId : null;
    const purchase = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(tokenPurchases)
        .where(eq(tokenPurchases.transactionHash, validatedData.transactionHash)).limit(1);
      if (existing) {
        if (existing.tokenizedSongId !== song.id || existing.buyerWalletAddress.toLowerCase() !== validatedData.buyerWalletAddress.toLowerCase()) {
          throw new Error('Transaction hash is already linked to a different purchase.');
        }
        return existing;
      }

      const [updatedSong] = await tx.update(tokenizedSongs)
        .set({ availableSupply: sql`${tokenizedSongs.availableSupply} - ${validatedData.amountTokens}`, updatedAt: new Date() })
        .where(and(
          eq(tokenizedSongs.id, song.id),
          eq(tokenizedSongs.isActive, true),
          gte(tokenizedSongs.availableSupply, validatedData.amountTokens),
        ))
        .returning({ id: tokenizedSongs.id });
      if (!updatedSong) throw new Error('Song is inactive or has insufficient remaining supply.');

      const [created] = await tx.insert(tokenPurchases).values({
        tokenizedSongId: song.id,
        buyerWalletAddress: validatedData.buyerWalletAddress,
        buyerUserId,
        amountTokens: validatedData.amountTokens,
        pricePaidEth: onchain.pricePaidEth,
        artistEarningsEth: artistEarnings.toString(),
        platformEarningsEth: platformEarnings.toString(),
        transactionHash: validatedData.transactionHash,
        blockNumber: onchain.blockNumber,
        status: 'confirmed',
      }).returning();
      await tx.insert(artistTokenEarnings).values({
        artistId: song.artistId,
        tokenizedSongId: song.id,
        purchaseId: created.id,
        amountEth: artistEarnings.toString(),
        transactionHash: validatedData.transactionHash,
      });
      return created;
    });

    res.status(201).json(purchase);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error recording purchase:', error);
    res.status(500).json({ error: 'Failed to record purchase' });
  }
});

router.put('/purchase/:transactionHash/confirm', (_req, res) => {
  return res.status(410).json({ error: 'Client-side confirmation is disabled. Purchases are recorded only after server-side Polygon verification.' });
});

router.get('/purchases/:artistId', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    if (isNaN(artistId)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    const purchases = await db.select({
      purchase: tokenPurchases,
      song: tokenizedSongs,
    })
      .from(tokenPurchases)
      .innerJoin(tokenizedSongs, eq(tokenPurchases.tokenizedSongId, tokenizedSongs.id))
      .where(eq(tokenizedSongs.artistId, artistId))
      .orderBy(desc(tokenPurchases.createdAt));

    res.json(purchases);
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

router.get('/earnings/:artistId', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    if (isNaN(artistId)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    const earnings = await db.select().from(artistTokenEarnings)
      .where(eq(artistTokenEarnings.artistId, artistId))
      .orderBy(desc(artistTokenEarnings.createdAt));

    const totalEarnings = earnings.reduce((acc, earning) => {
      return acc + parseFloat(earning.amountEth || '0');
    }, 0);

    res.json({
      earnings,
      totalEarningsEth: totalEarnings.toString(),
    });
  } catch (error) {
    console.error('Error fetching earnings:', error);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

router.put('/song/:id/toggle', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid song ID' });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Resolve Clerk string ID → numeric DB user ID
    const [dbUser] = await db.select({ id: users.id }).from(users)
      .where(eq(users.clerkId, req.user.id)).limit(1);
    if (!dbUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    const [song] = await db.select().from(tokenizedSongs)
      .where(eq(tokenizedSongs.id, id))
      .limit(1);

    if (!song) {
      return res.status(404).json({ error: 'Tokenized song not found' });
    }

    if (song.artistId !== dbUser.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [updated] = await db.update(tokenizedSongs)
      .set({ 
        isActive: !song.isActive,
        updatedAt: new Date()
      })
      .where(eq(tokenizedSongs.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error toggling song status:', error);
    res.status(500).json({ error: 'Failed to toggle song status' });
  }
});

router.get('/wallet/:walletAddress/tokens', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const userTokens = await db.select({
      purchase: tokenPurchases,
      song: tokenizedSongs,
      artist: {
        id: users.id,
        artistName: users.artistName,
        slug: users.slug,
      },
    })
      .from(tokenPurchases)
      .innerJoin(tokenizedSongs, eq(tokenPurchases.tokenizedSongId, tokenizedSongs.id))
      .innerJoin(users, eq(tokenizedSongs.artistId, users.id))
      .where(and(
        eq(tokenPurchases.buyerWalletAddress, walletAddress),
        eq(tokenPurchases.status, 'confirmed')
      ))
      .orderBy(desc(tokenPurchases.createdAt));

    res.json(userTokens);
  } catch (error) {
    console.error('Error fetching wallet tokens:', error);
    res.status(500).json({ error: 'Failed to fetch wallet tokens' });
  }
});

router.post('/ai/improve-description', async (req, res) => {
  try {
    const { songName, currentDescription } = req.body;
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Eres un experto en marketing musical y tokenización NFT. 
    
Nombre de la canción: "${songName}"
Descripción actual: "${currentDescription || 'Sin descripción'}"

Mejora esta descripción para una canción tokenizada en blockchain. La descripción debe:
- Ser atractiva y profesional (2-3 párrafos)
- Destacar el valor único de poseer tokens de esta canción
- Mencionar beneficios potenciales para los holders
- Usar lenguaje emocionante pero profesional
- Máximo 200 palabras

Responde SOLO con la descripción mejorada, sin explicaciones adicionales.`;

    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });

    const improvedDescription = completion.choices[0]?.message?.content || '';

    res.json({ description: improvedDescription });
  } catch (error: any) {
    console.error('Error improving description:', error);
    res.status(500).json({ error: 'Failed to improve description' });
  }
});

router.post('/ai/generate-image', async (req, res) => {
  try {
    const { songName, description } = req.body;
    
    const prompt = `Professional album cover art for the song "${songName}". 
${description ? `${description}. ` : ''}
High quality music cover art, vibrant colors, eye-catching design, modern style, professional photography, studio quality, 4k, artistic composition`;

    console.log('🎨 [TOKENIZATION] Generating image with FAL nano-banana for song:', songName);
    
    const result = await generateImageWithNanoBanana(prompt, {
      aspectRatio: '1:1',
      numImages: 1,
      outputFormat: 'png'
    });

    if (result.success && result.imageUrl) {
      console.log('✅ [TOKENIZATION] Image generated successfully with FAL nano-banana');
      return res.json({ imageUrl: result.imageUrl });
    } else {
      throw new Error(result.error || 'No image generated');
    }
  } catch (error: any) {
    console.error('❌ [TOKENIZATION] Error generating image:', error);
    res.status(500).json({ 
      error: 'Failed to generate image',
      details: error.message 
    });
  }
});

export default router;
