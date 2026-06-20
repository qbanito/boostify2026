/**
 * Upload all large media files from client/public and public to Firebase Storage
 * Generates server/asset-cdn-map.json with mappings from local path -> Firebase URL
 *
 * Usage: npx tsx scripts/upload-app-assets-to-firebase.ts
 */
import 'dotenv/config';
import { storage } from '../server/firebase';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MAP_FILE = path.join(PROJECT_ROOT, 'server', 'asset-cdn-map.json');

// Media extensions we'll migrate
const MEDIA_EXT = new Set(['.mp4', '.mov', '.webm', '.avi', '.mkv', '.mp3', '.wav', '.flac', '.ogg', '.m4a', '.pdf']);

// Folders to scan (paths that are publicly served)
const SCAN_DIRS = [
  { abs: path.join(PROJECT_ROOT, 'client', 'public'), urlPrefix: '' },
  { abs: path.join(PROJECT_ROOT, 'public'), urlPrefix: '' },
];

interface AssetMapping {
  [publicPath: string]: string; // e.g. "/assets/intro-video.mp4" -> "https://firebasestorage.googleapis.com/..."
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const result: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && MEDIA_EXT.has(path.extname(entry.name).toLowerCase())) {
        result.push(full);
      }
    }
  }
  return result;
}

function computeHash(filePath: string): string {
  const hash = crypto.createHash('md5');
  const buf = fs.readFileSync(filePath);
  hash.update(buf);
  return hash.digest('hex').slice(0, 8);
}

function getContentType(ext: string): string {
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.pdf': 'application/pdf',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

async function main() {
  if (!storage) {
    console.error('❌ Firebase Storage no inicializado. Verifica FIREBASE_ADMIN_KEY en .env');
    process.exit(1);
  }

  // Load existing map (we'll merge to avoid re-uploading)
  let existingMap: AssetMapping = {};
  if (fs.existsSync(MAP_FILE)) {
    try {
      existingMap = JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'));
      console.log(`📂 Loaded existing map: ${Object.keys(existingMap).length} entries`);
    } catch {
      console.warn('⚠️ Could not parse existing asset-cdn-map.json, starting fresh');
    }
  }

  const bucket = storage.bucket();
  console.log(`☁️ Bucket: ${bucket.name}\n`);

  // Collect all candidate files
  const allFiles: { absPath: string; publicPath: string }[] = [];
  for (const { abs, urlPrefix } of SCAN_DIRS) {
    const files = walk(abs);
    for (const f of files) {
      const rel = path.relative(abs, f).split(path.sep).join('/');
      const publicPath = urlPrefix + '/' + rel;
      allFiles.push({ absPath: f, publicPath });
    }
  }

  console.log(`📊 Found ${allFiles.length} media files to process\n`);

  const newMap: AssetMapping = { ...existingMap };
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const { absPath, publicPath } of allFiles) {
    const stat = fs.statSync(absPath);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
    const hash = computeHash(absPath);
    const ext = path.extname(absPath).toLowerCase();
    const baseName = path.basename(absPath, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
    const remoteName = `app-assets/${hash}_${baseName}${ext}`;

    // Skip if already uploaded with same hash
    if (existingMap[publicPath] && existingMap[publicPath].includes(hash)) {
      console.log(`⏭️  ${publicPath} (${sizeMB} MB) - already uploaded`);
      skipped++;
      continue;
    }

    try {
      const file = bucket.file(remoteName);
      const [exists] = await file.exists();

      if (!exists) {
        console.log(`⬆️  ${publicPath} (${sizeMB} MB) → ${remoteName}`);
        await bucket.upload(absPath, {
          destination: remoteName,
          metadata: {
            contentType: getContentType(ext),
            cacheControl: 'public, max-age=31536000, immutable',
          },
        });
      } else {
        console.log(`✓ ${publicPath} (${sizeMB} MB) - file exists in bucket`);
      }

      await file.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURI(remoteName)}`;
      newMap[publicPath] = publicUrl;
      uploaded++;
    } catch (err: any) {
      console.error(`❌ ${publicPath}: ${err?.message || err}`);
      failed++;
    }
  }

  // Sort keys for clean diff
  const sorted: AssetMapping = {};
  for (const k of Object.keys(newMap).sort()) {
    sorted[k] = newMap[k];
  }

  fs.writeFileSync(MAP_FILE, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`\n✅ Map written to: ${MAP_FILE}`);
  console.log(`📊 Uploaded: ${uploaded} | Skipped (cached): ${skipped} | Failed: ${failed} | Total in map: ${Object.keys(sorted).length}`);
}

main().catch((err) => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});
