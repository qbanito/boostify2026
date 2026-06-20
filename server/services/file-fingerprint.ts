// File fingerprinting + pre-publish scanning service.
// Generates SHA-256/MD5 hashes, captures evidence metadata, scans content
// for prohibited formats / oversized / corrupt / duplicates, and records a
// permanent fingerprint row used by the DMCA safe-harbor system.
import crypto from 'crypto';
import { db } from '../db';
import { fileFingerprints, legalAuditLog } from '../../db/schema';
import { eq } from 'drizzle-orm';

// Formats that may NOT be uploaded (executables / scripts / archives that can carry malware)
const PROHIBITED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif', 'cpl', 'jar', 'app', 'dmg',
  'sh', 'bash', 'ps1', 'vbs', 'js', 'jse', 'wsf', 'wsh', 'hta', 'reg',
  'dll', 'so', 'bin', 'apk', 'deb', 'rpm', 'php', 'asp', 'aspx', 'jsp',
];

const PROHIBITED_MIME = [
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-dosexec',
  'application/vnd.microsoft.portable-executable',
  'application/x-sh',
  'application/x-shellscript',
  'application/javascript',
  'text/javascript',
  'application/x-php',
];

// Default per-type size ceilings (bytes)
const SIZE_LIMITS: Record<string, number> = {
  image: 25 * 1024 * 1024,    // 25 MB
  audio: 200 * 1024 * 1024,   // 200 MB
  video: 1024 * 1024 * 1024,  // 1 GB
  document: 50 * 1024 * 1024, // 50 MB
  other: 50 * 1024 * 1024,    // 50 MB
};

// Magic-byte signatures used to detect corrupt / spoofed files
const MAGIC: Array<{ type: string; sig: number[]; offset?: number }> = [
  { type: 'image/jpeg', sig: [0xff, 0xd8, 0xff] },
  { type: 'image/png', sig: [0x89, 0x50, 0x4e, 0x47] },
  { type: 'image/gif', sig: [0x47, 0x49, 0x46, 0x38] },
  { type: 'image/webp', sig: [0x52, 0x49, 0x46, 0x46] },
  { type: 'application/pdf', sig: [0x25, 0x50, 0x44, 0x46] },
  { type: 'audio/mpeg', sig: [0x49, 0x44, 0x33] },      // ID3
  { type: 'audio/wav', sig: [0x52, 0x49, 0x46, 0x46] },
];

export function detectFileType(mime?: string, fileName?: string): string {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/')) return 'video';
  if (m === 'application/pdf' || m.includes('document') || m.startsWith('text/')) return 'document';
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) return 'document';
  return 'other';
}

export interface ScanReport {
  ok: boolean;
  prohibitedFormat: boolean;
  oversized: boolean;
  corrupt: boolean;
  malwareSuspected: boolean;
  duplicate: boolean;
  duplicateOfId: number | null;
  metadata: Record<string, unknown>;
  reasons: string[];
}

/** Run synchronous safety scan over a file buffer. */
export function scanFileBuffer(
  buffer: Buffer,
  opts: { fileName: string; mimeType?: string; fileType?: string },
): ScanReport {
  const fileType = opts.fileType || detectFileType(opts.mimeType, opts.fileName);
  const reasons: string[] = [];
  const ext = (opts.fileName || '').split('.').pop()?.toLowerCase() || '';

  const prohibitedFormat =
    PROHIBITED_EXTENSIONS.includes(ext) ||
    PROHIBITED_MIME.includes((opts.mimeType || '').toLowerCase());
  if (prohibitedFormat) reasons.push(`Formato no permitido: .${ext || opts.mimeType}`);

  const limit = SIZE_LIMITS[fileType] ?? SIZE_LIMITS.other;
  const oversized = buffer.length > limit;
  if (oversized) reasons.push(`Archivo demasiado grande (${(buffer.length / 1048576).toFixed(1)}MB > ${(limit / 1048576).toFixed(0)}MB)`);

  const corrupt = buffer.length === 0 || isCorrupt(buffer, opts.mimeType);
  if (corrupt) reasons.push('Archivo vacío o cabecera inválida (posible corrupción).');

  // Heuristic malware check: embedded PE/ELF/script signatures inside a "media" file
  const malwareSuspected = looksLikeExecutable(buffer) && fileType !== 'other';
  if (malwareSuspected) reasons.push('Contenido ejecutable detectado dentro del archivo.');

  return {
    ok: !prohibitedFormat && !oversized && !corrupt && !malwareSuspected,
    prohibitedFormat,
    oversized,
    corrupt,
    malwareSuspected,
    duplicate: false,
    duplicateOfId: null,
    metadata: { fileType, sizeBytes: buffer.length, ext, mimeType: opts.mimeType || null },
    reasons,
  };
}

function isCorrupt(buffer: Buffer, mime?: string): boolean {
  if (!mime) return false;
  const known = MAGIC.find((m) => m.type === mime.toLowerCase());
  if (!known) return false; // unknown type → can't assert corruption
  const off = known.offset || 0;
  for (let i = 0; i < known.sig.length; i++) {
    if (buffer[off + i] !== known.sig[i]) return true;
  }
  return false;
}

function looksLikeExecutable(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  // MZ (Windows PE)
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) return true;
  // ELF (Linux)
  if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) return true;
  // Mach-O
  const m32 = buffer.readUInt32BE(0);
  if ([0xfeedface, 0xfeedfacf, 0xcafebabe].includes(m32)) return true;
  // #! shebang
  if (buffer[0] === 0x23 && buffer[1] === 0x21) return true;
  return false;
}

export function computeHashes(buffer: Buffer) {
  return {
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    md5: crypto.createHash('md5').update(buffer).digest('hex'),
    sizeBytes: buffer.length,
  };
}

export interface FingerprintInput {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  fileUrl?: string | null;
  ownerId?: number | null;
  ownerEmail?: string | null;
  uploadIp?: string | null;
  userAgent?: string | null;
  consentId?: number | null;
}

/**
 * Full pipeline: hash → scan → duplicate check → persist fingerprint row.
 * Returns the created fingerprint plus the scan report. Does NOT throw on a
 * failed scan — callers decide whether to block the upload.
 */
export async function fingerprintAndScan(input: FingerprintInput) {
  const fileType = detectFileType(input.mimeType, input.fileName);
  const { sha256, md5, sizeBytes } = computeHashes(input.buffer);
  const scan = scanFileBuffer(input.buffer, {
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileType,
  });

  // Duplicate detection by exact content hash
  let duplicateOfId: number | null = null;
  try {
    const existing = await db
      .select({ id: fileFingerprints.id })
      .from(fileFingerprints)
      .where(eq(fileFingerprints.sha256, sha256))
      .limit(1);
    if (existing.length) {
      duplicateOfId = existing[0].id;
      scan.duplicate = true;
      scan.duplicateOfId = duplicateOfId;
      scan.metadata.duplicateOfId = duplicateOfId;
    }
  } catch {
    // non-fatal
  }

  const scanStatus: 'clean' | 'flagged' | 'rejected' = scan.prohibitedFormat || scan.malwareSuspected
    ? 'rejected'
    : scan.ok
      ? 'clean'
      : 'flagged';

  const [row] = await db
    .insert(fileFingerprints)
    .values({
      ownerId: input.ownerId ?? null,
      ownerEmail: input.ownerEmail ?? null,
      fileName: input.fileName,
      fileUrl: input.fileUrl ?? null,
      mimeType: input.mimeType ?? null,
      fileType,
      sizeBytes,
      sha256,
      md5,
      uploadIp: input.uploadIp ?? null,
      userAgent: input.userAgent ?? null,
      scanStatus,
      scanReport: scan as any,
      isDuplicateOf: duplicateOfId,
      consentId: input.consentId ?? null,
      status: 'active',
      history: [{ action: 'created', at: new Date().toISOString(), by: input.ownerId ?? null }] as any,
    })
    .returning();

  // Audit
  try {
    await db.insert(legalAuditLog).values({
      actorId: input.ownerId ?? null,
      actorEmail: input.ownerEmail ?? null,
      action: 'fingerprint.created',
      entityType: 'fingerprint',
      entityId: row.id,
      detail: { sha256, scanStatus, fileType, sizeBytes } as any,
      ip: input.uploadIp ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch {
    // non-fatal
  }

  return { fingerprint: row, scan, scanStatus };
}

/** Lightweight audit helper reused across legal routes. */
export async function legalAudit(entry: {
  actorId?: number | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string;
  entityId?: number | null;
  detail?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    await db.insert(legalAuditLog).values({
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      detail: (entry.detail ?? null) as any,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    });
  } catch (err) {
    console.error('[legalAudit] failed:', err);
  }
}
