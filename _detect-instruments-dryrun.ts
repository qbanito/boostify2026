/** Dry-run: strict instrumentalist detection over an IGEmailExtractor CSV. */
import fs from 'fs';
import { detectInstrument } from './shared/instruments';

const file = process.argv[2] || '/Users/neiveralvarez/Downloads/IGEmailExtractor-all-67-20260703002711.csv';
const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');

// RFC-4180-ish parser (same approach as server)
function parseCSV(t: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = []; let field = ''; let q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => (c || '').trim() !== ''))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
}

const rows = parseCSV(text);
let detected = 0;
const byInstrument: Record<string, number> = {};
const detectedRows: string[] = [];
const skippedRows: string[] = [];

for (const r of rows) {
  const bio = r['Biography'] || '';
  const name = r['Full Name'] || '';
  const handle = r['User Name'] || '';
  const d = detectInstrument({ bio, name, handle });
  if (d) {
    detected++;
    byInstrument[d.instrument] = (byInstrument[d.instrument] || 0) + 1;
    detectedRows.push(`  ✓ @${handle} → ${d.instrument} [${d.confidence}] evidence: "${d.evidence}"`);
  } else {
    skippedRows.push(`  ✗ @${handle} — "${(bio || '(sin bio)').replace(/\n/g, ' ').slice(0, 90)}"`);
  }
}

console.log(`\nDETECTADOS COMO INSTRUMENTISTAS (${detected}/${rows.length}):`);
console.log(detectedRows.join('\n'));
console.log(`\nPor instrumento: ${JSON.stringify(byInstrument)}`);
console.log(`\nNO DETECTADOS — quedan como leads normales (${skippedRows.length}):`);
console.log(skippedRows.join('\n'));
