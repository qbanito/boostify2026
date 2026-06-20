/**
 * Custom Blocks — owner-editable building blocks for artist profile pages.
 *
 * Block kinds (Phase 1):
 *   - text       : styled paragraph (heading + body, alignment, color, size, weight)
 *   - separator  : horizontal divider line (solid / dashed / gradient)
 *   - banner     : hero card with title, subtitle, optional CTA + background
 *   - section    : collapsible container with title and free-form body text
 *
 * Storage: `profileLayout.customBlocks: Record<string, CustomBlock>` and the
 * block id (e.g. `custom-block-xxxxxxx`) lives inside the regular `sectionOrder`
 * array so blocks can be drag-reordered, hidden and expanded just like any
 * built-in section.
 */
import React, { useState } from 'react';
import {
  Type, Minus, Megaphone, Layers,
  Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronRight,
  Sparkles, Flame, Rocket, Music2, Crown, Zap, Star,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

export type CustomBlockKind = 'text' | 'separator' | 'banner' | 'section';

export interface CustomBlockBase {
  id: string;                 // `custom-block-{rand}` — also used as section id
  kind: CustomBlockKind;
  createdAt: number;
}

export interface TextBlock extends CustomBlockBase {
  kind: 'text';
  heading?: string;
  body: string;
  align?: 'left' | 'center' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: string;             // hex or css color
  italic?: boolean;
}

export interface SeparatorBlock extends CustomBlockBase {
  kind: 'separator';
  style?: 'solid' | 'dashed' | 'dotted' | 'gradient' | 'double';
  color?: string;
  thickness?: number;         // px
  marginY?: number;           // px
  label?: string;             // optional centered label like "—  About  —"
}

export interface BannerBlock extends CustomBlockBase {
  kind: 'banner';
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  bgColor?: string;
  bgGradient?: string;        // CSS gradient string
  bgImageUrl?: string;
  textColor?: string;
  align?: 'left' | 'center' | 'right';
  height?: 'sm' | 'md' | 'lg';
}

export interface SectionBlock extends CustomBlockBase {
  kind: 'section';
  title: string;
  body: string;
  defaultOpen?: boolean;
  accentColor?: string;
}

export type CustomBlock = TextBlock | SeparatorBlock | BannerBlock | SectionBlock;

// ─── Helpers ─────────────────────────────────────────────────────────

export function isCustomBlockId(id: string): boolean {
  return typeof id === 'string' && id.startsWith('custom-block-');
}

export function newCustomBlockId(): string {
  // crypto.randomUUID may not exist in older browsers — fallback to Math.random
  const rand = (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `custom-block-${Date.now().toString(36)}-${rand}`;
}

export function makeDefaultBlock(kind: CustomBlockKind): CustomBlock {
  const base = { id: newCustomBlockId(), createdAt: Date.now() };
  switch (kind) {
    case 'text':
      return { ...base, kind: 'text', heading: '', body: 'Your text here…', align: 'left', size: 'md', weight: 'normal' };
    case 'separator':
      return { ...base, kind: 'separator', style: 'solid', thickness: 1, marginY: 16 };
    case 'banner':
      return { ...base, kind: 'banner', title: 'New banner', subtitle: '', align: 'center', height: 'md' };
    case 'section':
      return { ...base, kind: 'section', title: 'New section', body: '', defaultOpen: true };
  }
}

export function blockLabel(b: CustomBlock): string {
  if (b.kind === 'text') return b.heading?.trim() || (b.body || '').slice(0, 30) || 'Text block';
  if (b.kind === 'separator') return b.label?.trim() || 'Separator';
  if (b.kind === 'banner') return b.title || 'Banner';
  return b.title || 'Section';
}

export function blockIcon(kind: CustomBlockKind) {
  switch (kind) {
    case 'text': return Type;
    case 'separator': return Minus;
    case 'banner': return Megaphone;
    case 'section': return Layers;
  }
}

// ─── Renderer helpers ────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  sparkles: Sparkles,
  flame: Flame,
  rocket: Rocket,
  music: Music2,
  crown: Crown,
  zap: Zap,
  star: Star,
};

/** Per-vibe gradient pairs [from, to] relative to accent */
const VIBE_OVERLAY: Record<string, string> = {
  dark:       'radial-gradient(ellipse at 25% 60%, {A}28 0%, transparent 65%), radial-gradient(ellipse at 80% 20%, {A}15 0%, transparent 55%), linear-gradient(160deg, #08080f 0%, #0d0b18 60%, #0a0810 100%)',
  vibrant:    'radial-gradient(ellipse at 20% 50%, {A}40 0%, transparent 60%), radial-gradient(ellipse at 85% 15%, {A}25 0%, transparent 50%), linear-gradient(160deg, #0b0b14 0%, #100c1e 60%, #0c0b12 100%)',
  ethereal:   'radial-gradient(ellipse at 50% 30%, {A}30 0%, transparent 70%), radial-gradient(ellipse at 10% 80%, {A}18 0%, transparent 50%), linear-gradient(160deg, #0a0b14 0%, #0d0f1e 60%, #080c12 100%)',
  explosive:  'radial-gradient(ellipse at 30% 50%, {A}50 0%, transparent 55%), radial-gradient(ellipse at 75% 30%, {A}35 0%, transparent 50%), linear-gradient(160deg, #100808 0%, #160c0c 60%, #0e0808 100%)',
  smooth:     'radial-gradient(ellipse at 40% 60%, {A}25 0%, transparent 60%), radial-gradient(ellipse at 70% 20%, {A}18 0%, transparent 55%), linear-gradient(160deg, #0a0b0f 0%, #0c0e18 60%, #090b10 100%)',
  raw:        'radial-gradient(ellipse at 20% 70%, {A}35 0%, transparent 60%), radial-gradient(ellipse at 80% 25%, {A}20 0%, transparent 50%), linear-gradient(160deg, #0d0c0c 0%, #131010 60%, #0e0c0c 100%)',
  elegant:    'radial-gradient(ellipse at 60% 40%, {A}22 0%, transparent 65%), radial-gradient(ellipse at 15% 75%, {A}15 0%, transparent 50%), linear-gradient(160deg, #0c0b10 0%, #110e1a 60%, #0a0c12 100%)',
  futuristic: 'radial-gradient(ellipse at 50% 50%, {A}35 0%, transparent 65%), radial-gradient(ellipse at 90% 10%, {A}25 0%, transparent 50%), linear-gradient(160deg, #080c14 0%, #0a1020 60%, #060a10 100%)',
  nostalgic:  'radial-gradient(ellipse at 30% 50%, {A}28 0%, transparent 65%), radial-gradient(ellipse at 70% 80%, {A}18 0%, transparent 55%), linear-gradient(160deg, #100e0a 0%, #181410 60%, #0e0c08 100%)',
  rebellious: 'radial-gradient(ellipse at 40% 40%, {A}45 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, {A}30 0%, transparent 50%), linear-gradient(160deg, #0e0808 0%, #160a0a 60%, #100c0c 100%)',
};

function vibeGradient(vibe: string, accent: string): string {
  const tpl = VIBE_OVERLAY[vibe] || VIBE_OVERLAY.vibrant;
  return tpl.replace(/{A}/g, accent);
}

// ─── Renderer (read-only) ────────────────────────────────────────────

interface RendererProps {
  block: CustomBlock;
  accent?: string;
  cardStyles?: string;
  cardStyleInline?: React.CSSProperties;
}

const SIZE_CLASS = { sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-2xl' };
const WEIGHT_CLASS = { normal: 'font-normal', medium: 'font-medium', semibold: 'font-semibold', bold: 'font-bold' };
const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' };

export function CustomBlockRenderer({ block, accent = '#a78bfa', cardStyles, cardStyleInline }: RendererProps) {
  // ── TEXT BLOCK ──────────────────────────────────────────────────────
  if (block.kind === 'text') {
    const b = block;
    const isAI = (b as any).source === 'ai-profile-auto';

    if (isAI) {
      const symbol: string = (b as any).decorativeSymbol || '✦';
      const vibe: string = (b as any).genreVibe || 'vibrant';
      return (
        <div
          className={`${cardStyles || ''} relative overflow-hidden rounded-xl`}
          style={{
            ...cardStyleInline,
            background: `linear-gradient(135deg, ${accent}08 0%, transparent 100%)`,
            border: `1px solid ${accent}20`,
            padding: '1.5rem',
          }}
        >
          {/* Left accent bar */}
          <div
            className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
            style={{ background: `linear-gradient(180deg, transparent 0%, ${accent} 40%, ${accent} 60%, transparent 100%)` }}
          />

          {/* Opening decorative quote */}
          <div
            className="text-6xl leading-none font-black select-none mb-1 pl-4"
            style={{ color: accent, opacity: 0.18, fontFamily: 'Georgia, serif', lineHeight: 0.8 }}
          >
            "
          </div>

          <div className="pl-4">
            {/* Heading with gradient text */}
            {b.heading && (
              <div
                className="text-xl font-black mb-3 tracking-tight leading-tight"
                style={{
                  background: `linear-gradient(120deg, #ffffff 10%, ${accent} 60%, #ffffff 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {b.heading}
              </div>
            )}

            {/* Body text */}
            <p
              className="text-sm leading-[1.85] whitespace-pre-wrap"
              style={{
                color: 'rgba(255,255,255,0.78)',
                fontStyle: b.italic ? 'italic' : undefined,
              }}
            >
              {b.body}
            </p>

            {/* Bottom decoration */}
            <div className="mt-5 flex items-center gap-3">
              <div
                className="h-px flex-1"
                style={{ background: `linear-gradient(90deg, ${accent}70, transparent)` }}
              />
              <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: `${accent}90` }}>
                {symbol}
              </span>
              <div
                className="h-px w-8"
                style={{ background: `linear-gradient(90deg, transparent, ${accent}40)` }}
              />
            </div>
          </div>
        </div>
      );
    }

    // Default text block (non-AI)
    return (
      <div className={cardStyles} style={cardStyleInline}>
        {b.heading && (
          <div className="text-base font-semibold mb-2" style={{ color: accent }}>{b.heading}</div>
        )}
        <p
          className={`${SIZE_CLASS[b.size || 'md']} ${WEIGHT_CLASS[b.weight || 'normal']} ${ALIGN_CLASS[b.align || 'left']} whitespace-pre-wrap leading-relaxed`}
          style={{ color: b.color || undefined, fontStyle: b.italic ? 'italic' : undefined }}
        >
          {b.body}
        </p>
      </div>
    );
  }

  // ── SEPARATOR ───────────────────────────────────────────────────────
  if (block.kind === 'separator') {
    const b = block;
    const thickness = b.thickness ?? 1;
    const marginY = b.marginY ?? 16;
    const color = b.color || `${accent}66`;
    let lineEl: React.ReactNode;
    if (b.style === 'gradient') {
      lineEl = (
        <div
          style={{
            height: thickness,
            background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
            width: '100%',
          }}
        />
      );
    } else {
      const borderStyle = b.style === 'double' ? 'double' : (b.style || 'solid');
      const borderWidth = b.style === 'double' ? Math.max(thickness, 3) : thickness;
      lineEl = <div style={{ borderTop: `${borderWidth}px ${borderStyle} ${color}`, width: '100%' }} />;
    }
    return (
      <div className="flex items-center gap-3 w-full" style={{ marginTop: marginY, marginBottom: marginY }}>
        <div className="flex-1">{lineEl}</div>
        {b.label && (
          <span className="px-2 text-xs uppercase tracking-widest opacity-70" style={{ color }}>{b.label}</span>
        )}
        {b.label && <div className="flex-1">{lineEl}</div>}
      </div>
    );
  }

  // ── BANNER ──────────────────────────────────────────────────────────
  if (block.kind === 'banner') {
    const b = block;
    const isAI = (b as any).source === 'ai-profile-auto';
    const heightPx = b.height === 'sm' ? 180 : b.height === 'lg' ? 320 : 250;
    const alignFlex = b.align === 'right' ? 'items-end' : b.align === 'left' ? 'items-start' : 'items-center';
    const alignText = b.align === 'right' ? 'text-right' : b.align === 'left' ? 'text-left' : 'text-center';

    if (isAI) {
      const vibe: string = (b as any).genreVibe || 'vibrant';
      const iconName: string = (b as any).iconName || 'sparkles';
      const IconComp = ICON_MAP[iconName] || Sparkles;
      const bg = vibeGradient(vibe, accent);

      return (
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            minHeight: heightPx,
            background: bg,
            border: `1px solid ${accent}35`,
          }}
        >
          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(${accent}12 1px, transparent 1px), linear-gradient(90deg, ${accent}12 1px, transparent 1px)`,
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
            }}
          />

          {/* Top shimmer line */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent 0%, ${accent}90 50%, transparent 100%)` }}
          />

          {/* Corner glyph decorations */}
          <div
            className="absolute top-4 right-5 select-none pointer-events-none"
            style={{ color: accent, opacity: 0.15, fontSize: 64, lineHeight: 1, fontWeight: 900 }}
          >
            ◆
          </div>
          <div
            className="absolute bottom-4 left-5 select-none pointer-events-none"
            style={{ color: accent, opacity: 0.08, fontSize: 36, lineHeight: 1, fontWeight: 900 }}
          >
            ◆
          </div>

          {/* Content */}
          <div
            className={`relative z-10 px-6 py-8 flex flex-col ${alignFlex} ${alignText} justify-center`}
            style={{ minHeight: heightPx }}
          >
            {/* Glowing icon */}
            <div className="mb-5 relative inline-block">
              <div
                className="absolute inset-0 rounded-full blur-2xl"
                style={{ background: accent, opacity: 0.35, transform: 'scale(2)' }}
              />
              <div
                className="relative flex items-center justify-center w-12 h-12 rounded-full"
                style={{
                  background: `${accent}18`,
                  border: `1.5px solid ${accent}70`,
                  boxShadow: `0 0 24px ${accent}40, inset 0 1px 0 ${accent}30`,
                }}
              >
                <IconComp size={22} style={{ color: accent }} strokeWidth={2} />
              </div>
            </div>

            {/* Title — gradient text */}
            <h3
              className="text-3xl md:text-4xl font-black leading-tight tracking-tight mb-3 max-w-xl"
              style={{
                background: `linear-gradient(130deg, #ffffff 0%, ${accent} 55%, #e8e0ff 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: 'none',
              }}
            >
              {b.title}
            </h3>

            {/* Subtitle */}
            {b.subtitle && (
              <p
                className="text-sm md:text-base leading-relaxed mb-6 max-w-lg"
                style={{ color: 'rgba(255,255,255,0.72)' }}
              >
                {b.subtitle}
              </p>
            )}

            {/* CTA button */}
            {b.ctaLabel && b.ctaUrl && (
              <a
                href={b.ctaUrl}
                target={b.ctaUrl.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-7 py-2.5 rounded-full text-sm font-bold transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
                  color: '#0a0a0a',
                  boxShadow: `0 0 28px ${accent}55, 0 4px 16px rgba(0,0,0,0.4)`,
                  letterSpacing: '0.04em',
                }}
              >
                {b.ctaLabel}
                <span style={{ opacity: 0.7 }}>→</span>
              </a>
            )}
          </div>

          {/* Bottom shimmer */}
          <div
            className="absolute bottom-0 left-0 right-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent 0%, ${accent}40 50%, transparent 100%)` }}
          />
        </div>
      );
    }

    // Default banner (non-AI)
    const heightClass = b.height === 'sm' ? 'py-6' : b.height === 'lg' ? 'py-16' : 'py-10';
    const bg: React.CSSProperties = {};
    if (b.bgImageUrl) {
      bg.backgroundImage = `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('${b.bgImageUrl}')`;
      bg.backgroundSize = 'cover';
      bg.backgroundPosition = 'center';
    } else if (b.bgGradient) {
      bg.background = b.bgGradient;
    } else if (b.bgColor) {
      bg.background = b.bgColor;
    } else {
      bg.background = `linear-gradient(135deg, ${accent}30, ${accent}10)`;
    }
    return (
      <div
        className={`relative rounded-2xl overflow-hidden px-6 ${heightClass} ${ALIGN_CLASS[b.align || 'center']}`}
        style={{ ...bg, color: b.textColor || '#fff', border: `1px solid ${accent}30` }}
      >
        <h3 className="text-2xl md:text-3xl font-bold leading-tight">{b.title}</h3>
        {b.subtitle && (
          <p className="mt-2 text-sm md:text-base opacity-90 max-w-2xl mx-auto whitespace-pre-wrap">{b.subtitle}</p>
        )}
        {b.ctaLabel && b.ctaUrl && (
          <a
            href={b.ctaUrl}
            target={b.ctaUrl.startsWith('http') ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="inline-block mt-4 px-5 py-2 rounded-full text-sm font-semibold transition-transform hover:scale-105"
            style={{ background: accent, color: '#0a0a0a' }}
          >
            {b.ctaLabel}
          </a>
        )}
      </div>
    );
  }

  // ── SECTION ─────────────────────────────────────────────────────────
  const b = block;
  const [open, setOpen] = useState(b.defaultOpen ?? true);
  const stripe = b.accentColor || accent;
  return (
    <div className={cardStyles} style={cardStyleInline}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity text-left"
        style={{ color: stripe }}
      >
        {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        <Layers className="h-5 w-5" />
        <span className="text-base font-semibold flex-1">{b.title}</span>
      </button>
      {open && (
        <p className="text-sm whitespace-pre-wrap opacity-90 leading-relaxed">{b.body}</p>
      )}
    </div>
  );
}

// ─── Editor (modal) ──────────────────────────────────────────────────

interface EditorProps {
  block: CustomBlock;
  accent: string;
  onSave: (b: CustomBlock) => void;
  onCancel: () => void;
}

export function CustomBlockEditor({ block, accent, onSave, onCancel }: EditorProps) {
  const [draft, setDraft] = useState<CustomBlock>(block);

  const update = (patch: Partial<CustomBlock>) => setDraft(prev => ({ ...prev, ...patch } as CustomBlock));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        className="w-full max-w-lg rounded-2xl border bg-zinc-950 p-5 max-h-[90vh] overflow-y-auto"
        style={{ borderColor: `${accent}40` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white capitalize">Edit {draft.kind} block</h3>
          <button onClick={onCancel} className="p-1 rounded hover:bg-white/10"><X className="h-4 w-4 text-gray-400" /></button>
        </div>

        <div className="space-y-3">
          {draft.kind === 'text' && (
            <>
              <Field label="Heading (optional)">
                <input type="text" value={(draft as TextBlock).heading || ''} onChange={e => update({ heading: e.target.value } as any)} className={inputCls} />
              </Field>
              <Field label="Body">
                <textarea rows={5} value={(draft as TextBlock).body} onChange={e => update({ body: e.target.value } as any)} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Align">
                  <select value={(draft as TextBlock).align || 'left'} onChange={e => update({ align: e.target.value as any })} className={inputCls}>
                    <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                  </select>
                </Field>
                <Field label="Size">
                  <select value={(draft as TextBlock).size || 'md'} onChange={e => update({ size: e.target.value as any })} className={inputCls}>
                    <option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option><option value="xl">XL</option>
                  </select>
                </Field>
                <Field label="Weight">
                  <select value={(draft as TextBlock).weight || 'normal'} onChange={e => update({ weight: e.target.value as any })} className={inputCls}>
                    <option value="normal">Normal</option><option value="medium">Medium</option><option value="semibold">Semibold</option><option value="bold">Bold</option>
                  </select>
                </Field>
                <Field label="Color">
                  <input type="color" value={(draft as TextBlock).color || '#ffffff'} onChange={e => update({ color: e.target.value } as any)} className="h-9 w-full rounded-lg bg-black/40 border border-white/10" />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input type="checkbox" checked={!!(draft as TextBlock).italic} onChange={e => update({ italic: e.target.checked } as any)} />
                Italic
              </label>
            </>
          )}

          {draft.kind === 'separator' && (
            <>
              <Field label="Label (optional, centered)">
                <input type="text" value={(draft as SeparatorBlock).label || ''} onChange={e => update({ label: e.target.value } as any)} className={inputCls} placeholder="e.g. About" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Style">
                  <select value={(draft as SeparatorBlock).style || 'solid'} onChange={e => update({ style: e.target.value as any })} className={inputCls}>
                    <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option>
                    <option value="double">Double</option><option value="gradient">Gradient fade</option>
                  </select>
                </Field>
                <Field label="Color">
                  <input type="color" value={(draft as SeparatorBlock).color || '#a78bfa'} onChange={e => update({ color: e.target.value } as any)} className="h-9 w-full rounded-lg bg-black/40 border border-white/10" />
                </Field>
                <Field label="Thickness (px)">
                  <input type="number" min={1} max={10} value={(draft as SeparatorBlock).thickness ?? 1} onChange={e => update({ thickness: Number(e.target.value) } as any)} className={inputCls} />
                </Field>
                <Field label="Margin Y (px)">
                  <input type="number" min={0} max={120} value={(draft as SeparatorBlock).marginY ?? 16} onChange={e => update({ marginY: Number(e.target.value) } as any)} className={inputCls} />
                </Field>
              </div>
            </>
          )}

          {draft.kind === 'banner' && (
            <>
              <Field label="Title"><input type="text" value={(draft as BannerBlock).title} onChange={e => update({ title: e.target.value } as any)} className={inputCls} /></Field>
              <Field label="Subtitle"><textarea rows={2} value={(draft as BannerBlock).subtitle || ''} onChange={e => update({ subtitle: e.target.value } as any)} className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="CTA label"><input type="text" value={(draft as BannerBlock).ctaLabel || ''} onChange={e => update({ ctaLabel: e.target.value } as any)} className={inputCls} placeholder="Listen now" /></Field>
                <Field label="CTA URL"><input type="text" value={(draft as BannerBlock).ctaUrl || ''} onChange={e => update({ ctaUrl: e.target.value } as any)} className={inputCls} placeholder="https://…" /></Field>
                <Field label="Background image URL"><input type="text" value={(draft as BannerBlock).bgImageUrl || ''} onChange={e => update({ bgImageUrl: e.target.value } as any)} className={inputCls} placeholder="https://…" /></Field>
                <Field label="Gradient (CSS, optional)"><input type="text" value={(draft as BannerBlock).bgGradient || ''} onChange={e => update({ bgGradient: e.target.value } as any)} className={inputCls} placeholder="linear-gradient(135deg, #f00, #00f)" /></Field>
                <Field label="Background color"><input type="color" value={(draft as BannerBlock).bgColor || '#1a1a1a'} onChange={e => update({ bgColor: e.target.value } as any)} className="h-9 w-full rounded-lg bg-black/40 border border-white/10" /></Field>
                <Field label="Text color"><input type="color" value={(draft as BannerBlock).textColor || '#ffffff'} onChange={e => update({ textColor: e.target.value } as any)} className="h-9 w-full rounded-lg bg-black/40 border border-white/10" /></Field>
                <Field label="Align">
                  <select value={(draft as BannerBlock).align || 'center'} onChange={e => update({ align: e.target.value as any })} className={inputCls}>
                    <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                  </select>
                </Field>
                <Field label="Height">
                  <select value={(draft as BannerBlock).height || 'md'} onChange={e => update({ height: e.target.value as any })} className={inputCls}>
                    <option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option>
                  </select>
                </Field>
              </div>
            </>
          )}

          {draft.kind === 'section' && (
            <>
              <Field label="Title"><input type="text" value={(draft as SectionBlock).title} onChange={e => update({ title: e.target.value } as any)} className={inputCls} /></Field>
              <Field label="Body"><textarea rows={6} value={(draft as SectionBlock).body} onChange={e => update({ body: e.target.value } as any)} className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Accent color"><input type="color" value={(draft as SectionBlock).accentColor || accent} onChange={e => update({ accentColor: e.target.value } as any)} className="h-9 w-full rounded-lg bg-black/40 border border-white/10" /></Field>
                <label className="flex items-center gap-2 text-xs text-gray-300 mt-6">
                  <input type="checkbox" checked={(draft as SectionBlock).defaultOpen ?? true} onChange={e => update({ defaultOpen: e.target.checked } as any)} />
                  Open by default
                </label>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5">Cancel</button>
          <button
            onClick={() => onSave(draft)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-black flex items-center gap-1.5"
            style={{ backgroundColor: accent }}
          >
            <Check className="h-4 w-4" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}

// ─── Manager (in layout-config sidebar) ──────────────────────────────

interface ManagerProps {
  customBlocks: Record<string, CustomBlock>;
  accent: string;
  onAdd: (block: CustomBlock) => void;
  onEdit: (block: CustomBlock) => void;
  onDelete: (id: string) => void;
}

export function CustomBlocksAdder({ accent, onAdd }: { accent: string; onAdd: (b: CustomBlock) => void }) {
  const kinds: CustomBlockKind[] = ['text', 'separator', 'banner', 'section'];
  return (
    <div className="rounded-xl border p-3 mb-3" style={{ borderColor: `${accent}30`, background: `${accent}08` }}>
      <div className="flex items-center gap-2 mb-2">
        <Plus className="h-4 w-4" style={{ color: accent }} />
        <span className="text-xs font-semibold text-white">Add a custom block</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {kinds.map(k => {
          const Icon = blockIcon(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => onAdd(makeDefaultBlock(k))}
              className="flex flex-col items-center gap-1 p-2 rounded-lg border text-xs text-gray-200 hover:bg-white/5 transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <Icon className="h-4 w-4" style={{ color: accent }} />
              <span className="capitalize">{k}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface RowProps {
  block: CustomBlock;
  accent: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function CustomBlockEditorRow({ block, accent, onEdit, onDelete }: RowProps) {
  const Icon = blockIcon(block.kind);
  return (
    <div className="flex items-center gap-2 ml-7 mt-2 text-xs">
      <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
      <span className="text-gray-400 capitalize">{block.kind}</span>
      <span className="text-gray-500 truncate max-w-[180px]">· {blockLabel(block)}</span>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" onClick={onEdit} className="p-1 rounded hover:bg-white/10" title="Edit">
          <Pencil className="h-3.5 w-3.5 text-gray-400" />
        </button>
        <button type="button" onClick={onDelete} className="p-1 rounded hover:bg-red-500/10" title="Delete">
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
        </button>
      </div>
    </div>
  );
}
