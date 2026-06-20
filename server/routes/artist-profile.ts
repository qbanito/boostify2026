/**
 * Rutas para perfil de artista con generación automática de OpenAI + FAL Nano Banana
 */
import { Router, Request, Response } from 'express';
import { generateImageWithNanoBanana, editImageWithNanoBanana, generateMerchandiseImage, generateArtistDesignPack, generateArtistCharacterPack } from '../services/fal-service';
import { generateArtistBiography, type ArtistInfo } from '../services/openai-profile-service';
import { getOrCreateBrandProfile, generateBrandProfile, loadBrandProfile } from '../services/artist-brand-profile';
import Stripe from 'stripe';
import { db } from '../db';
import { users } from '../db/schema';
import { isNull, and } from 'drizzle-orm';
import { db as firestoreDb } from '../firebase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia'
});

const router = Router();

/**
 * Genera imagen de perfil de artista con FAL AI Nano Banana
 * Soporta imagen de referencia para preservar identidad facial
 */
router.post('/generate-profile-image', async (req: Request, res: Response) => {
  try {
    const { artistName, genre, style, biography, referenceImage } = req.body;
    
    if (!artistName) {
      return res.status(400).json({
        success: false,
        error: 'Artist name is required'
      });
    }
    
    // Crear prompt optimizado para imagen de perfil
    const basePrompt = `Professional artist profile photo: ${artistName}, ${genre || 'musician'} artist. 
    ${style || 'Modern, professional headshot with artistic lighting'}. 
    ${biography ? `Artist background: ${biography.substring(0, 200)}` : ''}.
    High quality portrait photography, studio lighting, professional artist photograph, 
    centered composition, clean background, artistic and professional aesthetic.`;
    
    console.log('🎨 Generating profile image with FAL AI Nano Banana...');
    
    let result;
    
    // Si hay imagen de referencia, usar edición con nano-banana
    if (referenceImage) {
      console.log('👤 Using reference image for facial consistency...');
      result = await editImageWithNanoBanana(
        [referenceImage],
        basePrompt,
        { aspectRatio: '1:1' }
      );
    } else {
      // Sin referencia, usar generación normal
      result = await generateImageWithNanoBanana(basePrompt, { aspectRatio: '1:1' });
    }
    
    console.log('🎨 Profile image result:', { success: result.success, hasError: !!result.error, provider: result.provider });
    if (!result.success) {
      console.error('❌ Profile image generation failed:', result.error);
    }
    return res.json(result);
  } catch (error: any) {
    console.error('Error generating profile image:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate profile image'
    });
  }
});

/**
 * Genera imagen de banner/portada de artista con FAL AI Nano Banana
 * Soporta imagen de referencia para incluir al artista en el banner
 */
router.post('/generate-banner-image', async (req: Request, res: Response) => {
  try {
    const { artistName, genre, style, mood, biography, referenceImage } = req.body;
    
    if (!artistName) {
      return res.status(400).json({
        success: false,
        error: 'Artist name is required'
      });
    }
    
    // Crear prompt optimizado para banner
    const basePrompt = `Professional artist banner cover image: ${artistName}, ${genre || 'musician'} artist. 
    ${style || 'Cinematic, wide-angle composition'}. 
    ${mood || 'Energetic and creative atmosphere'}. 
    ${biography ? `Artist style: ${biography.substring(0, 200)}` : ''}.
    Wide format banner, 16:9 aspect ratio, cinematic lighting, professional music artist aesthetic, 
    vibrant colors, high quality photography, artistic and dynamic composition.`;
    
    console.log('🎨 Generating banner image with FAL AI Nano Banana...');
    
    let result;
    
    // Si hay imagen de referencia, usar edición con nano-banana
    if (referenceImage) {
      console.log('👤 Using reference image for facial consistency in banner...');
      result = await editImageWithNanoBanana(
        [referenceImage],
        basePrompt,
        { aspectRatio: '16:9' }
      );
    } else {
      // Sin referencia, usar generación normal
      result = await generateImageWithNanoBanana(basePrompt, { aspectRatio: '16:9' });
    }
    
    console.log('🎨 Banner image result:', { success: result.success, hasError: !!result.error, provider: result.provider });
    if (!result.success) {
      console.error('❌ Banner image generation failed:', result.error);
    }
    return res.json(result);
  } catch (error: any) {
    console.error('Error generating banner image:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate banner image'
    });
  }
});

/**
 * Genera biografía de artista con OpenAI
 */
router.post('/generate-biography', async (req: Request, res: Response) => {
  try {
    const artistInfo: ArtistInfo = req.body;
    
    if (!artistInfo.name) {
      return res.status(400).json({
        success: false,
        error: 'Artist name is required'
      });
    }
    
    console.log('📝 Generating artist biography...');
    const result = await generateArtistBiography(artistInfo);
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error generating biography:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate biography'
    });
  }
});

/**
 * Genera imagen de producto de merchandise con FAL AI nano-banana/edit
 * Usa la imagen del perfil del artista como base para coherencia visual
 */
router.post('/generate-product-image', async (req: Request, res: Response) => {
  try {
    const { productType, artistName, artistId, artistImageUrl, brandImage, genre, masterDesignUrl, bio, useArtistAsModel } = req.body;
    
    if (!productType) {
      return res.status(400).json({
        success: false,
        error: 'Product type is required'
      });
    }
    
    // Accept brandImage as alias for artistImageUrl (client sends brandImage)
    let resolvedArtistImage = artistImageUrl || brandImage || '';
    let resolvedArtistName = artistName || '';
    let resolvedGenre = genre || '';
    let resolvedBio = bio || '';

    // 🔎 Auto-load artist profile photo from Firestore/Postgres if not provided.
    // The user wants the existing profile image used as the model — fetch it.
    if (artistId && (!resolvedArtistImage || !resolvedArtistName)) {
      try {
        const { db: firestoreDb } = await import('../firebase');
        if (firestoreDb) {
          const userSnap = await firestoreDb.collection('users').doc(String(artistId)).get();
          if (userSnap.exists) {
            const u: any = userSnap.data() || {};
            resolvedArtistImage = resolvedArtistImage
              || u.profileImageUrl || u.profileImage || u.photoURL || u.imageUrl || '';
            resolvedArtistName = resolvedArtistName || u.artistName || u.displayName || u.name || '';
            resolvedGenre = resolvedGenre || u.genre || '';
            resolvedBio = resolvedBio || u.bio || '';
          }
        }
      } catch (e: any) {
        console.warn('[generate-product-image] Firestore lookup failed:', e?.message);
      }
      // Postgres fallback
      if (!resolvedArtistImage || !resolvedArtistName) {
        try {
          const { db } = await import('../db');
          const { users } = await import('../../shared/schema');
          const { eq } = await import('drizzle-orm');
          const rows = await db.select().from(users).where(eq(users.id, Number(artistId))).limit(1);
          const u: any = rows?.[0];
          if (u) {
            resolvedArtistImage = resolvedArtistImage || u.profileImageUrl || '';
            resolvedArtistName = resolvedArtistName || u.artistName || u.username || '';
            resolvedGenre = resolvedGenre || u.genre || '';
            resolvedBio = resolvedBio || u.bio || '';
          }
        } catch (e: any) {
          console.warn('[generate-product-image] Postgres lookup failed:', e?.message);
        }
      }
    }

    console.log(`🎨 Generating ${productType} product image for ${resolvedArtistName || 'Artist'}... photo=${resolvedArtistImage ? 'yes' : 'NO'}`);

    // ── BRAND PROFILE: load (or generate) the artist's master JSON DNA ──
    // This guarantees every product is generated with the same visual identity.
    let brandProfile: any = null;
    let resolvedMasterDesign: string = masterDesignUrl || '';
    if (artistId) {
      try {
        // Try to enrich master logo from Firestore if not provided in body
        if (!resolvedMasterDesign) {
          const { db: firestoreDb } = await import('../firebase');
          if (firestoreDb) {
            const userSnap = await firestoreDb.collection('users').doc(String(artistId)).get();
            if (userSnap.exists) {
              const data = userSnap.data() || {};
              resolvedMasterDesign = data.masterDesignUrl || '';
            }
          }
        }
        brandProfile = await getOrCreateBrandProfile({
          artistId,
          artistName: resolvedArtistName || 'Artist',
          genre: resolvedGenre || 'pop',
          bio: resolvedBio,
          artistImageUrl: resolvedArtistImage,
          masterDesignUrl: resolvedMasterDesign,
        });
        console.log(`🧬 Brand profile loaded (source=${brandProfile.source}, palette=${brandProfile.brandColors.primary}/${brandProfile.brandColors.secondary})`);
      } catch (err: any) {
        console.warn('⚠️  Brand profile load/create failed, continuing without DNA:', err?.message);
      }
    }

    // generateMerchandiseImage now has full fallback chain: FAL → Gemini → DALL-E → FHDR Cloud → FHDR Local
    const falResult = await generateMerchandiseImage(
      resolvedArtistName || 'Artist',
      productType,
      resolvedArtistImage,
      resolvedGenre || 'Pop',
      {
        brandProfile,
        masterDesignUrl: resolvedMasterDesign,
        modelWithArtist: useArtistAsModel !== false,
      },
    );
    
    if (falResult.success && falResult.imageUrl) {
      console.log(`✅ ${productType} image generated successfully via ${falResult.provider || 'fal'}`);
      return res.json({
        success: true,
        imageUrl: falResult.imageUrl,
        provider: falResult.provider || 'fal'
      });
    }
    
    // generateMerchandiseImage already tried all fallbacks — try one more time with text-to-image chain
    console.log(`⚠️ Primary generation failed for ${productType}, trying text-to-image fallback chain...`);
    const fallbackResult = await generateImageWithNanoBanana(
      `Professional product photo of ${artistName || 'Artist'} ${productType} merchandise. Orange and black branding. White background, 4K quality.`
    );
    
    if (fallbackResult.success && fallbackResult.imageUrl) {
      console.log(`✅ ${productType} recovered via text-to-image fallback (${fallbackResult.provider})`);
      return res.json({
        success: true,
        imageUrl: fallbackResult.imageUrl,
        provider: fallbackResult.provider || 'fal-text-fallback'
      });
    }
    
    // All AI generators failed — serve a guaranteed static fallback so product cards still render.
    const productTypeLc = String(productType || '').toLowerCase();
    const staticFallbackPath =
      productTypeLc.includes('shirt') || productTypeLc.includes('hoodie') || productTypeLc.includes('cap') || productTypeLc.includes('hat')
        ? '/assets/Merchandise/camiseta.jpeg'
        : productTypeLc.includes('poster') || productTypeLc.includes('print')
          ? '/assets/Merchandise/print.jpeg'
          : productTypeLc.includes('mug') || productTypeLc.includes('sticker')
            ? '/assets/Merchandise/print.jpeg'
            : '/assets/Merchandise/camiseta.jpeg';

    console.log(`⚠️ All AI generators failed for ${productType}; using static fallback ${staticFallbackPath}`);
    return res.json({
      success: true,
      imageUrl: staticFallbackPath,
      provider: 'static-fallback',
      warning: `AI image generation temporarily unavailable for ${productType}`,
    });
  } catch (error: any) {
    console.error('Error generating product image:', error);
    return res.json({
      success: false,
      imageUrl: '',
      error: error.message || 'Failed to generate product image'
    });
  }
});

/**
 * Genera un Design Pack completo: 6 diseños print-ready únicos para Printful.
 * Cada diseño está optimizado para un tipo de producto (aspect ratio, estilo).
 * Opcionalmente guarda los productos en Firestore.
 * 
 * POST /api/artist-profile/generate-design-pack
 * Body: { artistName, artistImageUrl?, genre?, artistId?, saveToFirestore? }
 */
router.post('/generate-design-pack', async (req: Request, res: Response) => {
  try {
    const { artistName, artistImageUrl, genre, artistId, saveToFirestore } = req.body;

    if (!artistName) {
      return res.status(400).json({ success: false, error: 'artistName is required' });
    }

    console.log(`🎨 Generating Design Pack for ${artistName} (${genre || 'Pop'})...`);

    const pack = await generateArtistDesignPack(
      artistName,
      artistImageUrl || '',
      genre || 'Pop'
    );

    const successCount = pack.designs.filter(d => d.success).length;
    console.log(`✅ Design Pack: ${successCount}/6 designs generated for ${artistName}`);

    // Optionally save products to Firestore
    if (saveToFirestore && artistId) {
      try {
        const { initializeApp, cert, getApps } = await import('firebase-admin/app');
        const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

        if (getApps().length === 0) {
          initializeApp({
            credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID!,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
              privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
            }),
          });
        }
        const firestoreDb = getFirestore();

        // Save each design to artist's design pack
        const designPackRef = firestoreDb.collection('artists').doc(artistId).collection('designPack');
        for (const design of pack.designs) {
          if (design.success) {
            await designPackRef.doc(design.designType).set({
              designType: design.designType,
              displayName: design.displayName,
              imageUrl: design.imageUrl,
              aspectRatio: design.aspectRatio,
              generatedAt: FieldValue.serverTimestamp(),
            });
          }
        }

        // Save products to merchandise collection
        for (const product of pack.products) {
          if (product.imageUrl && !product.imageUrl.includes('placeholder')) {
            await firestoreDb.collection('merchandise').add({
              artistId,
              artistName,
              name: product.name,
              productType: product.type,
              designType: product.designType,
              imageUrl: product.imageUrl,
              images: [product.imageUrl],
              price: product.price,
              category: ['T-Shirt', 'Hoodie'].includes(product.type) ? 'apparel' : 'accessories',
              stock: 100,
              isAvailable: true,
              salesCount: 0,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }

        console.log(`✅ Design Pack saved to Firestore for artist ${artistId}`);
      } catch (firestoreErr: any) {
        console.error('⚠️ Failed to save design pack to Firestore:', firestoreErr.message);
      }
    }

    return res.json({
      success: true,
      designs: pack.designs,
      products: pack.products,
      stats: {
        total: pack.designs.length,
        generated: successCount,
        failed: pack.designs.length - successCount,
      },
    });
  } catch (error: any) {
    console.error('❌ Error generating design pack:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate design pack',
    });
  }
});

/**
 * Helper para obtener la URL base según el entorno
 * PRODUCCIÓN: boostifymusic.com
 */
const getBaseUrl = () => {
  const productionUrl = process.env.PRODUCTION_URL || 'https://boostifymusic.com';
  
  if (process.env.NODE_ENV === 'production') {
    return productionUrl;
  }
  
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    return `https://${domains[0]}`;
  }
  
  return 'http://localhost:5000';
};

/**
 * Crea sesión de checkout de Stripe para comprar producto
 *
 * Tanda 3: enriquecemos con datos de Firestore (artistUserId, productImage, productType)
 * cuando el cliente pasa productId — para que el webhook tenga TODA la metadata
 * necesaria y siempre pueda registrar la venta en salesTransactions.
 */
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    let {
      productName,
      productPrice,
      productImage,
      printFileUrl,
      artistName,
      artistSlug,
      productId,
      productType,
      size,
      printfulVariantId,
      printfulProductId,
      color,
    } = req.body;
    let artistUserId: number | null = null;
    let isCustomProduct = false;
    let firestoreProductId = productId || '';

    // Enriquecer desde Firestore si tenemos productId
    if (productId) {
      try {
        const { db: firestoreDb } = await import('../firebase');
        if (firestoreDb) {
          const doc = await firestoreDb.collection('merchandise').doc(productId).get();
          if (doc.exists) {
            const data = doc.data() || {};
            productName = productName || data.name;
            productPrice = productPrice || data.price;
            productImage = productImage || data.imageUrl || (Array.isArray(data.images) ? data.images[0] : '');
            artistName = artistName || data.artistName;
            productType = productType || data.productType || data.type;
            isCustomProduct = data.aiGenerated === false || data.isCustom === true;
            const uid = Number(data.userId);
            if (Number.isFinite(uid) && uid > 0) artistUserId = uid;
          }
        }
      } catch (enrichErr) {
        console.warn('⚠️ Firestore enrichment failed:', (enrichErr as any)?.message);
      }
    }

    // Lookup artistUserId by artistName si aún no lo tenemos
    if (!artistUserId && artistName) {
      try {
        const { eq } = await import('drizzle-orm');
        const result = await db.select({ id: users.id })
          .from(users)
          .where(eq(users.artistName, artistName))
          .limit(1);
        if (result[0]?.id) artistUserId = result[0].id;
      } catch { /* best effort */ }
    }

    if (!productName || !productPrice) {
      return res.status(400).json({
        success: false,
        error: 'Product name and price are required'
      });
    }

    const BASE_URL = getBaseUrl();
    const safeArtistSlug = (() => {
      const fromBody = String(artistSlug || '').trim();
      if (fromBody) return encodeURIComponent(fromBody);
      const fromName = String(artistName || '').trim().toLowerCase().replace(/\s+/g, '-');
      return encodeURIComponent(fromName || 'artist');
    })();
    const successUrl = `${BASE_URL}/artist/${safeArtistSlug}?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${BASE_URL}/artist/${safeArtistSlug}?canceled=true`;

    console.log(`💳 Creating Stripe checkout session for ${productName} (${size || 'default size'}) | artistUserId=${artistUserId} | custom=${isCustomProduct}`);
    console.log(`🔗 Using BASE_URL: ${BASE_URL}`);
    
    // Crear sesión de checkout de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${productName}${size ? ` - Size: ${size}` : ''}`,
              description: `${artistName} Official Merchandise`,
              images: productImage ? [productImage] : undefined,
            },
            unit_amount: Math.round(productPrice * 100), // Convertir a centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_creation: 'always',
      customer_update: {
        address: 'auto',
        name: 'auto',
        shipping: 'auto',
      },
      billing_address_collection: 'required',
      phone_number_collection: { enabled: true },
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'DE', 'FR', 'ES', 'IT', 'AU', 'MX', 'BR', 'JP'],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'usd' },
            display_name: 'Standard Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 7 },
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        productId: firestoreProductId || '',
        artistName: artistName || '',
        artistUserId: artistUserId ? String(artistUserId) : '',
        isCustomProduct: isCustomProduct ? '1' : '0',
        productType: productType || '',
        productImage: productImage || '',
        printFileUrl: printFileUrl || '',
        size: size || '',
        price: String(productPrice || ''),
        printfulVariantId: (() => {
          // Productos custom del artista: NO van a Printful (los maneja el artista)
          if (isCustomProduct) return '';
          // If frontend passed an explicit Printful variant id (from /catalog/:id/variants picker), use it directly
          if (printfulVariantId) return String(printfulVariantId);
          const variantMap: Record<string, Record<string, number>> = {
            'T-Shirt': { S: 4017, M: 4018, L: 4019, XL: 4020, '2XL': 4025 },
            'Hoodie': { S: 24985, M: 24986, L: 24987, XL: 24988, '2XL': 24991 },
            'Cap': { 'One size': 15904 },
            'Poster': { '16.5×23.4″ (A2)': 19528, '23.4×33.1″ (A1)': 19527 },
            'Sticker Pack': { '3×3″': 10163, '4×4″': 10164, '5.5×5.5″': 10165 },
            'Mug': { '11 oz': 1320, '15 oz': 4830 },
          };
          const typeMap = variantMap[productType];
          if (!typeMap) return '';
          return String(typeMap[size] ?? Object.values(typeMap)[0] ?? '');
        })(),
        printfulProductId: printfulProductId ? String(printfulProductId) : '',
        color: color || '',
        type: 'merchandise',
      },
    });
    
    console.log(`✅ Checkout session created: ${session.id}`);
    console.log(`✅ Success URL: ${successUrl}`);
    
    return res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create checkout session'
    });
  }
});

/**
 * Genera imágenes faltantes para artistas sin profile_image y cover_image
 * POST /api/artist-profile/generate-missing-images
 */
router.post('/generate-missing-images', async (req: Request, res: Response) => {
  try {
    console.log('🎨 Starting to generate missing images for artists...');
    
    // Obtener artistas sin imágenes
    const artistsWithoutImages = await db
      .select()
      .from(users)
      .where(
        and(
          isNull(users.profileImage),
          isNull(users.coverImage)
        )
      );
    
    console.log(`📊 Found ${artistsWithoutImages.length} artists without images`);
    
    const results = [];
    
    for (const artist of artistsWithoutImages) {
      try {
        console.log(`🎨 Generating images for: ${artist.artistName}`);
        
        const genre = artist.genres?.[0] || 'music';
        const biography = artist.biography || 'Professional musician';
        
        // Generar imagen de perfil con FAL nano-banana
        const profilePrompt = `Professional artist profile photo: ${artist.artistName}, ${genre} artist. Modern, professional headshot with artistic lighting. Biography: ${biography.substring(0, 200)}. High quality portrait photography, studio lighting, professional artist photograph, centered composition, clean background, artistic and professional aesthetic.`;
        
        const profileResult = await generateImageWithNanoBanana(profilePrompt, { aspectRatio: '1:1' });
        
        // Generar imagen de banner con FAL nano-banana
        const bannerPrompt = `Professional artist banner cover image: ${artist.artistName}, ${genre} artist. Cinematic, wide-angle composition. Biography: ${biography.substring(0, 200)}. Wide format banner, 16:9 aspect ratio, cinematic lighting, professional music artist aesthetic, vibrant colors, high quality photography, artistic and dynamic composition.`;
        
        const bannerResult = await generateImageWithNanoBanana(bannerPrompt, { aspectRatio: '16:9' });
        
        if (profileResult.success && profileResult.imageUrl && bannerResult.success && bannerResult.imageUrl) {
          // Guardar URLs en PostgreSQL
          await db.update(users)
            .set({
              profileImage: profileResult.imageUrl,
              coverImage: bannerResult.imageUrl,
              updatedAt: new Date()
            })
            .where(users.id === artist.id);
          
          console.log(`✅ Images generated and saved for ${artist.artistName}`);
          results.push({
            artistId: artist.id,
            artistName: artist.artistName,
            success: true,
            profileImage: profileResult.imageUrl,
            coverImage: bannerResult.imageUrl
          });
        } else {
          console.warn(`⚠️ Failed to generate images for ${artist.artistName}`);
          results.push({
            artistId: artist.id,
            artistName: artist.artistName,
            success: false,
            error: 'Image generation failed'
          });
        }
        
        // Pequeño delay entre llamadas
        await new Promise(r => setTimeout(r, 1000));
        
      } catch (error: any) {
        console.error(`❌ Error generating images for ${artist.artistName}:`, error);
        results.push({
          artistId: artist.id,
          artistName: artist.artistName,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: `Generated images for ${results.filter(r => r.success).length}/${results.length} artists`,
      results
    });
    
  } catch (error: any) {
    console.error('Error in generate-missing-images:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate missing images'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// BRAND PROFILE ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/artist-profile/brand-profile/:artistId
 * Returns the stored ArtistBrandProfile or null.
 */
router.get('/brand-profile/:artistId', async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    if (!artistId) return res.status(400).json({ success: false, error: 'artistId required' });
    const profile = await loadBrandProfile(artistId);
    return res.json({ success: true, profile });
  } catch (error: any) {
    console.error('Error loading brand profile:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/artist-profile/brand-profile/generate
 * Generate (or regenerate) the master brand JSON for an artist.
 * Body: { artistId, artistName, genre, bio?, artistImageUrl?, masterDesignUrl?, force? }
 */
router.post('/brand-profile/generate', async (req: Request, res: Response) => {
  try {
    const { artistId, artistName, genre, bio, artistImageUrl, masterDesignUrl, force } = req.body;
    if (!artistId) {
      return res.status(400).json({ success: false, error: 'artistId is required' });
    }

    // Auto-enrich missing fields from the artist record so the JSON is always
    // generated from the REAL profile photo / genre / bio (vision needs the URL).
    let resolvedName = artistName || '';
    let resolvedGenre = genre || '';
    let resolvedBio = bio || '';
    let resolvedImage = artistImageUrl || '';
    let resolvedMaster = masterDesignUrl || '';
    if (!resolvedName || !resolvedGenre || !resolvedBio || !resolvedImage) {
      try {
        const { db: firestoreDb } = await import('../firebase');
        if (firestoreDb) {
          const snap = await firestoreDb.collection('users').doc(String(artistId)).get();
          if (snap.exists) {
            const u: any = snap.data() || {};
            resolvedName = resolvedName || u.artistName || u.displayName || u.name || '';
            resolvedGenre = resolvedGenre || u.genre || '';
            resolvedBio = resolvedBio || u.bio || u.biography || '';
            resolvedImage = resolvedImage || u.profileImageUrl || u.profileImage || u.photoURL || u.imageUrl || '';
            resolvedMaster = resolvedMaster || u.masterDesignUrl || '';
          }
        }
      } catch (e: any) {
        console.warn('[brand-profile/generate] Firestore lookup failed:', e?.message);
      }
      // Postgres fallback
      if (!resolvedName || !resolvedGenre || !resolvedBio || !resolvedImage) {
        try {
          const { db } = await import('../db');
          const { users } = await import('../db/schema');
          const { eq } = await import('drizzle-orm');
          const rows = await db.select().from(users).where(eq(users.id, Number(artistId))).limit(1);
          const u: any = rows?.[0];
          if (u) {
            resolvedName = resolvedName || u.artistName || u.username || '';
            resolvedGenre = resolvedGenre || u.genre || '';
            resolvedBio = resolvedBio || u.bio || u.biography || '';
            resolvedImage = resolvedImage || u.profileImageUrl || '';
          }
        } catch (e: any) {
          console.warn('[brand-profile/generate] Postgres lookup failed:', e?.message);
        }
      }
    }

    if (!resolvedName) {
      return res.status(400).json({ success: false, error: 'artistName could not be resolved' });
    }

    const profile = force
      ? await generateBrandProfile({
          artistId,
          artistName: resolvedName,
          genre: resolvedGenre || 'pop',
          bio: resolvedBio,
          artistImageUrl: resolvedImage,
          masterDesignUrl: resolvedMaster,
        })
      : await getOrCreateBrandProfile({
          artistId,
          artistName: resolvedName,
          genre: resolvedGenre || 'pop',
          bio: resolvedBio,
          artistImageUrl: resolvedImage,
          masterDesignUrl: resolvedMaster,
          forceRegenerate: false,
        });
    return res.json({ success: true, profile });
  } catch (error: any) {
    console.error('Error generating brand profile:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Genera un Character Pack de 4 imágenes usando la foto de perfil del artista como referencia
 * Las imágenes son guaradas en Firebase Storage y devueltas como URLs permanentes.
 */
router.post('/character-pack', async (req: Request, res: Response) => {
  try {
    const { artistId, artistName, genre, profileImageUrl } = req.body;

    if (!profileImageUrl) {
      return res.status(400).json({ success: false, error: 'profileImageUrl is required' });
    }
    if (!artistName) {
      return res.status(400).json({ success: false, error: 'artistName is required' });
    }

    const result = await generateArtistCharacterPack(
      profileImageUrl,
      artistName,
      genre || 'music',
      artistId ? `artist-character-packs/${artistId}` : 'artist-character-packs',
    );

    // Save to Firestore image_galleries so images appear in artist profile gallery
    if (result.success && result.images.length > 0) {
      try {
        if (firestoreDb) {
          const fsUserId = artistId ? String(artistId) : 'unknown';
          await firestoreDb.collection('image_galleries').add({
            userId: fsUserId,
            singleName: `Character Pack — ${artistName}`,
            artistName: artistName || 'Artist',
            basePrompt: 'character-pack',
            styleInstructions: 'AI Character Pack — 4 signature photos',
            referenceImageUrls: [profileImageUrl],
            generatedImages: result.images.map((img: any) => ({
              id: img.id || `char-${Date.now()}`,
              url: img.url,
              prompt: img.prompt || '',
              createdAt: img.createdAt || new Date().toISOString(),
              isVideo: false,
            })),
            source: 'character-pack',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPublic: false,
          });
          console.log('[artist-profile] ✅ Character pack saved to Firestore image_galleries');
        }
      } catch (fsErr) {
        console.warn('[artist-profile] ⚠️ Could not save character pack to Firestore:', fsErr);
      }
    }

    return res.json(result);
  } catch (error: any) {
    console.error('[artist-profile] character-pack error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Generation failed' });
  }
});

export default router;
