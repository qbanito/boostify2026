// ─────────────────────────────────────────────────────────────────────────
// importSeatMap — parse a theater seat map from JSON or CSV into the editor's
// draft structure. Lets an artist/venue "sync any theater" by importing an
// export from their box-office system instead of hand-building the map.
// ─────────────────────────────────────────────────────────────────────────
// Supported inputs:
//  • JSON  → { venue?, sections?, seats[] }  (sections optional — derived from
//            seat.section if absent). Seats reference a section by name.
//  • CSV   → one row per seat with a header. Flexible column names (English /
//            Spanish aliases). Sections are derived from the unique section
//            column; price/color/kind taken from each section's first row.
//
// When x/y coordinates are absent, seats are auto-laid-out in a clean grid
// (sections stacked top→bottom, rows top→bottom, seats left→right) so the map
// looks tidy even from a raw box-office dump.
// ─────────────────────────────────────────────────────────────────────────

export type ImportKind = 'seats' | 'tables' | 'ga';

export interface ImportSection {
  tempId: string;
  name: string;
  kind: ImportKind;
  color: string;
  defaultPrice: number;
  gaCapacity: number;
  tableSeats: number;
  x: number;
  y: number;
  // grid params (kept so the editor's "regenerate" still works after import)
  rows: number;
  cols: number;
  startRow: string;
  startNumber: number;
}
export interface ImportSeat {
  sectionTempId: string;
  kind: 'seat' | 'table';
  rowLabel?: string;
  seatNumber?: string;
  label: string;
  capacity: number;
  x: number;
  y: number;
  priceOverride?: number | null;
  isBlocked?: boolean;
}
export interface ImportResult {
  meta: { name: string; city: string; country: string; address: string; stageLabel: string; canvasWidth: number; canvasHeight: number };
  sections: ImportSection[];
  seatsBySection: Record<string, ImportSeat[]>;
  stats: { sections: number; seats: number; ga: number };
}

const PALETTE = ['#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4', '#a855f7'];
const SPACING_X = 26;
const SPACING_Y = 28;

function uid() { return Math.random().toString(36).slice(2, 9); }
function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}
function truthy(v: unknown): boolean {
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'si' || s === 'sí' || s === 'x' || s === 'blocked';
}
function normHex(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`;
  return null;
}

// ── CSV parsing (RFC-4180-ish: handles quotes, commas, CRLF) ─────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',' || c === ';' || c === '\t') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c === '\r') {
      // swallow — handled by the following \n (or end)
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const ALIASES: Record<string, string[]> = {
  section: ['section', 'sección', 'seccion', 'sector', 'zone', 'zona', 'area', 'área', 'level', 'tribuna'],
  row: ['row', 'fila', 'rowlabel', 'row_label', 'rownum'],
  seat: ['seat', 'number', 'seatnumber', 'seat_number', 'seatnum', 'asiento', 'num', 'no', 'seat_no'],
  x: ['x', 'posx', 'pos_x', 'x_pos', 'cx'],
  y: ['y', 'posy', 'pos_y', 'y_pos', 'cy'],
  price: ['price', 'precio', 'amount', 'cost', 'importe', 'tarifa'],
  kind: ['kind', 'type', 'tipo', 'category'],
  color: ['color', 'colour', 'hex'],
  blocked: ['blocked', 'bloqueado', 'disabled', 'broken', 'kill', 'isblocked'],
  capacity: ['capacity', 'capacidad', 'seats', 'sillas', 'pax'],
};

function mapHeader(header: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  header.forEach((raw, i) => {
    const h = raw.trim().toLowerCase().replace(/\s+/g, '');
    for (const [key, names] of Object.entries(ALIASES)) {
      if (names.includes(h) && idx[key] === undefined) idx[key] = i;
    }
  });
  return idx;
}

interface RawSeat {
  section: string; row?: string; seat?: string; x?: number; y?: number;
  price?: number; kind?: string; color?: string; blocked?: boolean; capacity?: number;
}

function fromCsv(text: string): { venue?: any; raw: RawSeat[] } {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV needs a header row plus at least one seat.');
  const idx = mapHeader(rows[0]);
  if (idx.section === undefined) throw new Error('CSV must have a "section" column (also: sección, zona, sector).');
  const raw: RawSeat[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const section = (cells[idx.section] || '').trim();
    if (!section) continue;
    raw.push({
      section,
      row: idx.row !== undefined ? (cells[idx.row] || '').trim() : undefined,
      seat: idx.seat !== undefined ? (cells[idx.seat] || '').trim() : undefined,
      x: idx.x !== undefined ? num(cells[idx.x], NaN) : undefined,
      y: idx.y !== undefined ? num(cells[idx.y], NaN) : undefined,
      price: idx.price !== undefined ? num(cells[idx.price], NaN) : undefined,
      kind: idx.kind !== undefined ? (cells[idx.kind] || '').trim().toLowerCase() : undefined,
      color: idx.color !== undefined ? (cells[idx.color] || '').trim() : undefined,
      blocked: idx.blocked !== undefined ? truthy(cells[idx.blocked]) : false,
      capacity: idx.capacity !== undefined ? num(cells[idx.capacity], NaN) : undefined,
    });
  }
  return { raw };
}

function fromJson(text: string): { venue?: any; raw: RawSeat[]; sections?: any[] } {
  const data = JSON.parse(text);
  // Accept several shapes: array of seats, {seats}, or {venue, sections, seats}.
  const seatsArr: any[] = Array.isArray(data) ? data : (data.seats || data.Seats || []);
  const sectionsArr: any[] | undefined = data.sections || data.Sections;
  const venue = data.venue || data.Venue || undefined;
  if (!Array.isArray(seatsArr) || !seatsArr.length) {
    // sections-only (GA-style) import is allowed
    if (sectionsArr && sectionsArr.length) return { venue, raw: [], sections: sectionsArr };
    throw new Error('JSON must contain a non-empty "seats" array (or "sections").');
  }
  const raw: RawSeat[] = seatsArr.map((s: any) => ({
    section: String(s.section ?? s.sectionName ?? s.zone ?? s.area ?? 'General').trim() || 'General',
    row: s.row ?? s.rowLabel ?? s.fila,
    seat: s.seat ?? s.number ?? s.seatNumber ?? s.asiento,
    x: s.x !== undefined ? num(s.x, NaN) : undefined,
    y: s.y !== undefined ? num(s.y, NaN) : undefined,
    price: s.price !== undefined ? num(s.price, NaN) : (s.priceOverride !== undefined ? num(s.priceOverride, NaN) : undefined),
    kind: (s.kind ?? s.type)?.toString().toLowerCase(),
    color: s.color,
    blocked: truthy(s.blocked ?? s.isBlocked),
    capacity: s.capacity !== undefined ? num(s.capacity, NaN) : undefined,
  }));
  return { venue, raw, sections: sectionsArr };
}

/** Build the editor draft from parsed raw seats (+ optional explicit sections). */
function build(raw: RawSeat[], explicitSections?: any[], venue?: any): ImportResult {
  // 1) Resolve the section list (explicit first, then any seen on seats).
  const sectionByName = new Map<string, ImportSection>();
  const order: string[] = [];
  const ensureSection = (name: string, seed?: Partial<ImportSection>) => {
    const key = name || 'General';
    if (!sectionByName.has(key)) {
      const i = order.length;
      sectionByName.set(key, {
        tempId: uid(), name: key, kind: (seed?.kind as ImportKind) || 'seats',
        color: seed?.color || PALETTE[i % PALETTE.length],
        defaultPrice: seed?.defaultPrice ?? 0, gaCapacity: seed?.gaCapacity ?? 0, tableSeats: seed?.tableSeats ?? 4,
        x: 60, y: 0, rows: 1, cols: 1, startRow: 'A', startNumber: 1,
      });
      order.push(key);
    }
    return sectionByName.get(key)!;
  };

  if (Array.isArray(explicitSections)) {
    for (const s of explicitSections) {
      const name = String(s.name ?? s.section ?? s.id ?? 'Section').trim() || 'Section';
      const kindRaw = String(s.kind ?? s.type ?? 'seats').toLowerCase();
      const kind: ImportKind = kindRaw === 'ga' || kindRaw === 'general' ? 'ga' : kindRaw === 'tables' || kindRaw === 'table' ? 'tables' : 'seats';
      ensureSection(name, {
        kind, color: normHex(s.color) || undefined,
        defaultPrice: num(s.defaultPrice ?? s.price, 0),
        gaCapacity: num(s.gaCapacity ?? s.capacity, 0),
      });
    }
  }

  // 2) Bucket seats under their section; learn price/color/kind from first hit.
  const seatsByName = new Map<string, RawSeat[]>();
  for (const s of raw) {
    const sec = ensureSection(s.section, {
      kind: s.kind === 'table' || s.kind === 'tables' ? 'tables' : undefined,
      color: normHex(s.color) || undefined,
      defaultPrice: Number.isFinite(s.price as number) ? (s.price as number) : undefined,
    });
    // refine section defaults from seats if not yet set
    if (!sec.defaultPrice && Number.isFinite(s.price as number)) sec.defaultPrice = s.price as number;
    if (s.color && normHex(s.color)) sec.color = normHex(s.color)!;
    if (s.kind === 'table' || s.kind === 'tables') sec.kind = 'tables';
    (seatsByName.get(sec.name) || seatsByName.set(sec.name, []).get(sec.name)!).push(s);
  }

  // 3) Layout. Use provided x/y when present; otherwise auto-grid, stacking
  //    sections top→bottom with rows and seats in reading order.
  const sections: ImportSection[] = [];
  const seatsBySection: Record<string, ImportSeat[]> = {};
  let cursorY = 70;
  let maxX = 600;
  let gaCount = 0;

  for (const name of order) {
    const sec = sectionByName.get(name)!;
    const bucket = seatsByName.get(name) || [];
    sec.y = cursorY;

    if (sec.kind === 'ga' && !bucket.length) {
      sec.gaCapacity = sec.gaCapacity || 100;
      gaCount += sec.gaCapacity;
      sections.push(sec);
      seatsBySection[sec.tempId] = [];
      cursorY += 90;
      continue;
    }

    const hasCoords = bucket.some((s) => Number.isFinite(s.x) && Number.isFinite(s.y));
    const isTables = sec.kind === 'tables';
    const out: ImportSeat[] = [];

    if (hasCoords) {
      // Honor the venue's real coordinates (already a designed map).
      for (const s of bucket) {
        const label = `${s.row || ''}${s.seat || ''}`.trim() || (s.row || s.seat || 'S');
        out.push({
          sectionTempId: sec.tempId, kind: isTables ? 'table' : 'seat',
          rowLabel: s.row, seatNumber: s.seat, label,
          capacity: isTables ? Math.max(1, num(s.capacity, sec.tableSeats || 4)) : 1,
          x: Math.round(s.x as number), y: Math.round(s.y as number),
          priceOverride: Number.isFinite(s.price as number) ? (s.price as number) : null,
          isBlocked: !!s.blocked,
        });
        maxX = Math.max(maxX, Math.round(s.x as number) + 40);
        cursorY = Math.max(cursorY, Math.round(s.y as number) + 40);
      }
      cursorY += 50;
    } else {
      // Auto-grid: group by row in first-seen order.
      const rowsOrder: string[] = [];
      const byRow = new Map<string, RawSeat[]>();
      bucket.forEach((s, i) => {
        const rk = s.row || String.fromCharCode(65 + Math.floor(i / 20)); // fallback row every 20
        if (!byRow.has(rk)) { byRow.set(rk, []); rowsOrder.push(rk); }
        byRow.get(rk)!.push(s);
      });
      const stepX = isTables ? SPACING_X + 14 : SPACING_X;
      const stepY = isTables ? SPACING_Y + 14 : SPACING_Y;
      rowsOrder.forEach((rk, ri) => {
        const rowSeats = byRow.get(rk)!;
        rowSeats.forEach((s, ci) => {
          const seatNo = s.seat || String(ci + 1);
          const label = `${rk}${seatNo}`;
          const x = 80 + ci * stepX;
          out.push({
            sectionTempId: sec.tempId, kind: isTables ? 'table' : 'seat',
            rowLabel: rk, seatNumber: seatNo, label,
            capacity: isTables ? Math.max(1, num(s.capacity, sec.tableSeats || 4)) : 1,
            x, y: cursorY + 18 + ri * stepY,
            priceOverride: Number.isFinite(s.price as number) ? (s.price as number) : null,
            isBlocked: !!s.blocked,
          });
          maxX = Math.max(maxX, x + 40);
        });
      });
      cursorY += rowsOrder.length * stepY + 70;
    }

    sections.push(sec);
    seatsBySection[sec.tempId] = out;
  }

  const seatTotal = Object.values(seatsBySection).reduce((a, x) => a + x.length, 0);
  const canvasWidth = Math.max(800, Math.min(3000, maxX + 60));
  const canvasHeight = Math.max(500, Math.min(3000, cursorY + 30));

  return {
    meta: {
      name: String(venue?.name ?? '').trim(),
      city: String(venue?.city ?? '').trim(),
      country: String(venue?.country ?? '').trim(),
      address: String(venue?.address ?? '').trim(),
      stageLabel: String(venue?.stageLabel ?? 'STAGE').trim() || 'STAGE',
      canvasWidth, canvasHeight,
    },
    sections,
    seatsBySection,
    stats: { sections: sections.length, seats: seatTotal, ga: gaCount },
  };
}

/** Parse a JSON or CSV string (auto-detected) into the editor draft. */
export function parseSeatMapImport(text: string): ImportResult {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Paste or upload a JSON or CSV seat map first.');
  const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  if (looksJson) {
    const { venue, raw, sections } = fromJson(trimmed);
    return build(raw, sections, venue);
  }
  const { venue, raw } = fromCsv(trimmed);
  return build(raw, undefined, venue);
}

/** A small, copy-pasteable CSV template for box offices. */
export const CSV_TEMPLATE = `section,row,seat,price,x,y,kind,color,blocked
Orchestra,A,1,150,,,seat,#7c3aed,
Orchestra,A,2,150,,,seat,#7c3aed,
Orchestra,A,3,150,,,seat,#7c3aed,
Orchestra,B,1,150,,,seat,#7c3aed,
Orchestra,B,2,150,,,seat,#7c3aed,
Mezzanine,A,1,90,,,seat,#ec4899,
Mezzanine,A,2,90,,,seat,#ec4899,
VIP Tables,1,T1,400,,,table,#f59e0b,
VIP Tables,1,T2,400,,,table,#f59e0b,`;

/** A small JSON template (with explicit coordinates) for designed maps. */
export const JSON_TEMPLATE = JSON.stringify({
  venue: { name: 'My Theater', city: 'Miami', country: 'US', stageLabel: 'STAGE' },
  sections: [
    { name: 'Orchestra', kind: 'seats', color: '#7c3aed', defaultPrice: 150 },
    { name: 'Balcony', kind: 'seats', color: '#ec4899', defaultPrice: 90 },
  ],
  seats: [
    { section: 'Orchestra', row: 'A', seat: '1', x: 120, y: 120, price: 150 },
    { section: 'Orchestra', row: 'A', seat: '2', x: 150, y: 120, price: 150 },
    { section: 'Balcony', row: 'A', seat: '1', x: 120, y: 320, price: 90 },
  ],
}, null, 2);
