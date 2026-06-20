import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import sharp from 'sharp';
import { PKPass } from 'passkit-generator';

const router = Router();

type WalletPlatform = 'ios' | 'android' | 'generic';

const DEFAULT_PASS_BACKGROUND = '#111111';
const DEFAULT_PASS_FOREGROUND = 'rgb(255,255,255)';
const DEFAULT_PASS_LABEL = 'rgb(255,198,143)';
const DEFAULT_BRAND_COLOR = '#ff7a00';

interface WalletPayload {
  platform?: string;
  userAgent?: string;
  name?: string;
  genre?: string;
  biography?: string;
  website?: string;
  instagram?: string;
  youtube?: string;
  profileUrl?: string;
}

function cleanText(value: any): string {
  return String(value || '')
    .replace(/[\r\n;,]/g, ' ')
    .trim();
}

function detectPlatform(input?: string): WalletPlatform {
  const ua = String(input || '').toLowerCase();
  if (/iphone|ipad|ipod|ios/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'generic';
}

function toSlug(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function toObjectIdPart(value: string): string {
  return String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function normalizePemValue(raw?: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';

  if (value.includes('-----BEGIN')) {
    return value.replace(/\\n/g, '\n');
  }

  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    if (decoded.includes('-----BEGIN')) {
      return decoded.replace(/\\n/g, '\n');
    }
  } catch {
    // Ignore and fallback below.
  }

  return value.replace(/\\n/g, '\n');
}

function getPublicBaseUrl(req: Request): string {
  const configured = String(process.env.PUBLIC_APP_URL || process.env.VITE_APP_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  const protocol = req.protocol || 'https';
  const host = req.get('host') || '';
  return `${protocol}://${host}`.replace(/\/+$/, '');
}

function getWalletPayloadFromRequest(req: Request): WalletPayload {
  const source = req.method === 'GET' ? req.query : req.body || {};
  return {
    platform: cleanText(source.platform),
    userAgent: cleanText(source.userAgent || req.headers['user-agent']),
    name: cleanText(source.name),
    genre: cleanText(source.genre),
    biography: cleanText(source.biography),
    website: cleanText(source.website),
    instagram: cleanText(source.instagram),
    youtube: cleanText(source.youtube),
    profileUrl: cleanText(source.profileUrl),
  };
}

function hasAppleWalletConfig(): boolean {
  return Boolean(
    normalizePemValue(process.env.APPLE_WALLET_CERT_PEM) &&
    normalizePemValue(process.env.APPLE_WALLET_KEY_PEM) &&
    normalizePemValue(process.env.APPLE_WWDR_CERT_PEM) &&
    String(process.env.APPLE_PASS_TYPE_IDENTIFIER || '').trim() &&
    String(process.env.APPLE_TEAM_IDENTIFIER || '').trim()
  );
}

function hasGoogleWalletConfig(): boolean {
  return Boolean(
    String(process.env.GOOGLE_WALLET_ISSUER_ID || '').trim() &&
    String(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL || '').trim() &&
    normalizePemValue(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY)
  );
}

function getStableProfileUrl(req: Request, payload: WalletPayload): string {
  if (payload.profileUrl) return payload.profileUrl;
  return `${getPublicBaseUrl(req)}/artist`;
}

async function buildSolidPng(width: number, height: number, hexColor: string): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: hexColor,
    },
  })
    .png()
    .toBuffer();
}

async function generateApplePass(req: Request, payload: WalletPayload): Promise<Buffer> {
  const signerCert = normalizePemValue(process.env.APPLE_WALLET_CERT_PEM);
  const signerKey = normalizePemValue(process.env.APPLE_WALLET_KEY_PEM);
  const wwdr = normalizePemValue(process.env.APPLE_WWDR_CERT_PEM);
  const signerKeyPassphrase = String(process.env.APPLE_WALLET_KEY_PASSPHRASE || '').trim() || undefined;

  const passTypeIdentifier = String(process.env.APPLE_PASS_TYPE_IDENTIFIER || '').trim();
  const teamIdentifier = String(process.env.APPLE_TEAM_IDENTIFIER || '').trim();
  const organizationName = String(process.env.APPLE_ORGANIZATION_NAME || 'Boostify Music').trim();

  if (!signerCert || !signerKey || !wwdr || !passTypeIdentifier || !teamIdentifier) {
    throw new Error('Apple Wallet signing is not configured');
  }

  const artistName = payload.name || 'Boostify Artist';
  const profileUrl = getStableProfileUrl(req, payload);
  const serialNumber = `boostify-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const description = `${artistName} Artist Card`;
  const heroColor = String(process.env.APPLE_PASS_BRAND_COLOR || DEFAULT_BRAND_COLOR);

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier,
    teamIdentifier,
    organizationName,
    serialNumber,
    description,
    logoText: artistName,
    foregroundColor: DEFAULT_PASS_FOREGROUND,
    backgroundColor: DEFAULT_PASS_BACKGROUND,
    labelColor: DEFAULT_PASS_LABEL,
    generic: {
      primaryFields: [
        {
          key: 'name',
          label: 'ARTIST',
          value: artistName,
        },
      ],
      secondaryFields: [
        {
          key: 'genre',
          label: 'GENRE',
          value: payload.genre || 'Music',
        },
      ],
      auxiliaryFields: [
        {
          key: 'instagram',
          label: 'INSTAGRAM',
          value: payload.instagram ? `@${payload.instagram.replace(/^@/, '')}` : '@boostifymusic',
        },
      ],
      backFields: [
        {
          key: 'bio',
          label: 'BIO',
          value: (payload.biography || '').slice(0, 240) || `${artistName} on Boostify Music`,
        },
        {
          key: 'website',
          label: 'WEBSITE',
          value: payload.website || profileUrl,
        },
        {
          key: 'profile',
          label: 'PROFILE',
          value: profileUrl,
        },
      ],
    },
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: profileUrl,
        messageEncoding: 'iso-8859-1',
        altText: 'Open artist profile',
      },
    ],
  };

  const [icon, icon2x, logo, logo2x, background] = await Promise.all([
    buildSolidPng(29, 29, heroColor),
    buildSolidPng(58, 58, heroColor),
    buildSolidPng(160, 50, heroColor),
    buildSolidPng(320, 100, heroColor),
    buildSolidPng(180, 220, '#202020'),
  ]);

  const pass = new PKPass(
    {
      'pass.json': Buffer.from(JSON.stringify(passJson), 'utf8'),
      'icon.png': icon,
      'icon@2x.png': icon2x,
      'logo.png': logo,
      'logo@2x.png': logo2x,
      'background.png': background,
    },
    {
      wwdr,
      signerCert,
      signerKey,
      signerKeyPassphrase,
    },
    {
      serialNumber,
      description,
    }
  );

  return pass.getAsBuffer();
}

function base64Url(input: string | Buffer): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwtRs256(payload: Record<string, any>, privateKeyPem: string): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(privateKeyPem);
  return `${signingInput}.${base64Url(signature)}`;
}

function buildGoogleWalletSaveUrl(req: Request, payload: WalletPayload): string {
  const issuerId = String(process.env.GOOGLE_WALLET_ISSUER_ID || '').trim();
  const serviceEmail = String(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL || '').trim();
  const privateKey = normalizePemValue(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY);
  const classSuffix = String(process.env.GOOGLE_WALLET_CLASS_SUFFIX || 'boostify_artist_card').trim();

  if (!issuerId || !serviceEmail || !privateKey) {
    throw new Error('Google Wallet signing is not configured');
  }

  const artistName = payload.name || 'Boostify Artist';
  const profileUrl = getStableProfileUrl(req, payload);
  const safeClassSuffix = toObjectIdPart(classSuffix) || 'boostify_artist_card';
  const classId = `${issuerId}.${safeClassSuffix}`;
  const objectUniquePart = toObjectIdPart(`${toSlug(artistName) || 'artist'}_${Date.now()}`);
  const objectId = `${issuerId}.${objectUniquePart}`;
  const origin = getPublicBaseUrl(req);

  const jwtPayload = {
    iss: serviceEmail,
    aud: 'google',
    typ: 'savetowallet',
    origins: [origin],
    payload: {
      genericClasses: [
        {
          id: classId,
          issuerName: 'Boostify Music',
          reviewStatus: 'UNDER_REVIEW',
          hexBackgroundColor: 'FF7A00',
        },
      ],
      genericObjects: [
        {
          id: objectId,
          classId,
          state: 'ACTIVE',
          cardTitle: {
            defaultValue: {
              language: 'en-US',
              value: artistName,
            },
          },
          subheader: {
            defaultValue: {
              language: 'en-US',
              value: payload.genre || 'Artist',
            },
          },
          barcode: {
            type: 'QR_CODE',
            value: profileUrl,
            alternateText: 'Open artist profile',
          },
          linksModuleData: {
            uris: [
              {
                id: 'profile',
                description: 'Artist profile',
                uri: profileUrl,
              },
            ],
          },
          textModulesData: [
            {
              id: 'bio',
              header: 'Bio',
              body: (payload.biography || '').slice(0, 240) || `${artistName} on Boostify Music`,
            },
          ],
        },
      ],
    },
  };

  const token = signJwtRs256(jwtPayload, privateKey);
  return `https://pay.google.com/gp/v/save/${token}`;
}

function buildVCard(payload: {
  name?: string;
  genre?: string;
  biography?: string;
  website?: string;
  instagram?: string;
  youtube?: string;
  profileUrl?: string;
}): string {
  const name = cleanText(payload.name || 'Boostify Artist');
  const genre = cleanText(payload.genre || 'Artist');
  const bio = cleanText(String(payload.biography || '').slice(0, 140));
  const website = cleanText(payload.website || payload.profileUrl || '');
  const instagram = cleanText(payload.instagram || '');
  const youtube = cleanText(payload.youtube || '');
  const profileUrl = cleanText(payload.profileUrl || '');

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${name};;;;`,
    `FN:${name}`,
    'ORG:Boostify Music',
    `TITLE:${genre}`,
    bio ? `NOTE:${bio}` : '',
    website ? `URL:${website}` : '',
    profileUrl ? `item1.URL:${profileUrl}` : '',
    profileUrl ? 'item1.X-ABLabel:Boostify Profile' : '',
    instagram ? `item2.URL:https://instagram.com/${instagram.replace('@', '')}` : '',
    instagram ? 'item2.X-ABLabel:Instagram' : '',
    youtube ? `item3.URL:https://youtube.com/${youtube.replace('@', '')}` : '',
    youtube ? 'item3.X-ABLabel:YouTube' : '',
    'END:VCARD',
  ].filter(Boolean);

  return `${lines.join('\n')}\n`;
}

router.post('/wallet/resolve', (req: Request, res: Response) => {
  try {
    const {
      platform: hintedPlatform,
      userAgent,
      name,
      genre,
      biography,
      website,
      instagram,
      youtube,
      profileUrl,
    } = getWalletPayloadFromRequest(req);

    const platform = detectPlatform(hintedPlatform || userAgent || req.headers['user-agent']);
    const safeName = cleanText(name || 'artist').replace(/[^a-z0-9\-_]+/gi, '-').toLowerCase();

    const query = new URLSearchParams({
      name: cleanText(name || 'Boostify Artist'),
      genre: cleanText(genre || ''),
      biography: cleanText(biography || ''),
      website: cleanText(website || ''),
      instagram: cleanText(instagram || ''),
      youtube: cleanText(youtube || ''),
      profileUrl: cleanText(profileUrl || ''),
    }).toString();

    const nativeAppleUrl = `/api/artist-card/wallet/apple/pass?${query}`;
    const nativeGoogleUrl = `/api/artist-card/wallet/google/save?${query}`;

    if (platform === 'ios' && hasAppleWalletConfig()) {
      return res.json({
        success: true,
        action: 'open_url',
        platform,
        url: nativeAppleUrl,
        message: 'Apple Wallet pass generated natively by Boostify backend.',
      });
    }

    if (platform === 'android' && hasGoogleWalletConfig()) {
      return res.json({
        success: true,
        action: 'open_url',
        platform,
        url: nativeGoogleUrl,
        message: 'Google Wallet JWT generated natively by Boostify backend.',
      });
    }

    // Fallback: serve vCard via a direct URL so the browser can open it inline in Contacts
    const vcardUrl = `/api/artist-card/wallet/vcard?${query}`;

    return res.json({
      success: true,
      action: 'open_url',
      platform,
      url: vcardUrl,
      message: 'Native wallet not configured. Opening universal business card (.vcf).',
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to resolve wallet action',
    });
  }
});

// GET /wallet/vcard — serves vCard inline so iOS/Android opens it in Contacts directly
router.get('/wallet/vcard', (req: Request, res: Response) => {
  try {
    const payload = getWalletPayloadFromRequest(req);
    const vcard = buildVCard(payload);
    const safeName = cleanText(payload.name || 'artist').replace(/[^a-z0-9\-_]+/gi, '-').toLowerCase();
    const fileName = `${safeName}-business-card.vcf`;

    // inline (not attachment) so mobile browsers open in Contacts rather than downloading
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(vcard);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate vCard',
    });
  }
});

router.get('/wallet/apple/pass', async (req: Request, res: Response) => {
  try {
    if (!hasAppleWalletConfig()) {
      return res.status(503).json({
        success: false,
        error: 'Apple Wallet is not configured on this environment',
      });
    }

    const payload = getWalletPayloadFromRequest(req);
    const passBuffer = await generateApplePass(req, payload);
    const safeName = toSlug(payload.name || 'artist-card') || 'artist-card';
    const fileName = `${safeName}.pkpass`;

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(passBuffer);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate Apple Wallet pass',
    });
  }
});

router.get('/wallet/google/save', (req: Request, res: Response) => {
  try {
    if (!hasGoogleWalletConfig()) {
      return res.status(503).json({
        success: false,
        error: 'Google Wallet is not configured on this environment',
      });
    }

    const payload = getWalletPayloadFromRequest(req);
    const saveUrl = buildGoogleWalletSaveUrl(req, payload);
    return res.redirect(saveUrl);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate Google Wallet JWT',
    });
  }
});

export default router;
