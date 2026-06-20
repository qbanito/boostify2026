import { useState, useCallback, useRef } from 'react';
import {
  Upload, Cpu, Users, Sliders, Palette, Shield, Radio,
  BarChart3, Layers, Send, ChevronRight, ChevronLeft,
  CheckCircle2, AlertTriangle, XCircle, Loader2,
  Star, Zap, Eye, Film, Globe, RefreshCw, Download,
  Lock, Unlock, Info, Camera, Shirt, Scissors, Sparkles, ImageOff,
} from 'lucide-react';
import {
  FORGE_STEPS,
  ForgeStep,
  ArtistReferenceImage,
  ReferenceImageType,
  CharacterIdentity,
  BaseCharacterMatch,
  MorphProfile,
  RigValidationResult,
  HoloSuitCompatibilityProfile,
  CharacterQualityReport,
  StageOSCharacterPackage,
  CharacterVariant,
  GeneratedCharacter,
} from '../../schemas/character-forge/index';
import {
  BASE_CHARACTER_LIBRARY,
  analyzeArtistImages,
  matchBaseCharacter,
  generateMorphProfile,
  validateRig,
  buildHoloSuitProfile,
  generateQualityReport,
  buildCharacterVariants,
  exportToStageOS,
  AnalysisProgressEvent,
} from '../../services/character-forge/characterForgeEngine';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#000000',
  panel:   '#0d0d0d',
  card:    '#111111',
  border:  '#1f1f1f',
  orange:  '#f97316',
  orangeL: '#fb923c',
  cyan:    '#22d3ee',
  green:   '#22c55e',
  red:     '#ef4444',
  amber:   '#f59e0b',
  muted:   '#6b7280',
  text:    '#e5e5e5',
  white:   '#ffffff',
};

// ─── Reference image labels ───────────────────────────────────────────────────
const IMAGE_SLOTS: Array<{ type: ReferenceImageType; label: string; hint: string; icon: React.ReactNode }> = [
  { type: 'face_front',        label: 'Frontal',    hint: 'Foto frontal del rostro',  icon: <Camera size={16}/> },
  { type: 'face_side',         label: 'Lateral',    hint: 'Perfil del rostro',         icon: <Camera size={16}/> },
  { type: 'face_three_quarter',label: '3/4 Face',   hint: 'Ángulo 3/4 del rostro',    icon: <Camera size={16}/> },
  { type: 'full_body',         label: 'Cuerpo',     hint: 'Foto cuerpo completo',      icon: <Users size={16}/> },
  { type: 'hair_reference',    label: 'Cabello',    hint: 'Referencia de cabello',     icon: <Scissors size={16}/> },
  { type: 'wardrobe_reference',label: 'Ropa',       hint: 'Referencia de outfit',      icon: <Shirt size={16}/> },
  { type: 'stage_style',       label: 'Stage Style',hint: 'Estilo escénico',           icon: <Zap size={16}/> },
];

// ─── Score color helper ───────────────────────────────────────────────────────
function scoreColor(v: number) {
  if (v >= 85) return C.green;
  if (v >= 70) return C.amber;
  return C.red;
}
function scoreLabel(v: number) {
  if (v >= 85) return 'Excelente';
  if (v >= 70) return 'Aceptable';
  return 'Necesita mejora';
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, color = C.orange }: { value: number; color?: string }) {
  return (
    <div style={{ background: '#1a1a1a', borderRadius: 6, height: 6, overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 6, transition: 'width 0.4s ease' }} />
    </div>
  );
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1a1a1a" strokeWidth={7} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      <text x={size/2} y={size/2} dominantBaseline="middle" textAnchor="middle"
        style={{ fill: color, fontSize: size * 0.22, fontWeight: 700, transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}>
        {score}
      </text>
    </svg>
  );
}

// ─── Step sidebar ─────────────────────────────────────────────────────────────
function StepSidebar({
  current, completed,
}: { current: ForgeStep; completed: Set<ForgeStep> }) {
  const stepIcons: Record<ForgeStep, React.ReactNode> = {
    upload:        <Upload size={14}/>,
    analyzing:     <Cpu size={14}/>,
    base_selection:<Users size={14}/>,
    morph_editor:  <Sliders size={14}/>,
    texture_hair:  <Palette size={14}/>,
    rig_validation:<Shield size={14}/>,
    holosuit:        <Radio size={14}/>,
    quality:       <BarChart3 size={14}/>,
    variants:      <Layers size={14}/>,
    export:        <Send size={14}/>,
  };
  const currentIdx = FORGE_STEPS.findIndex(s => s.id === current);
  return (
    <div style={{ width: 200, flexShrink: 0, borderRight: `1px solid ${C.border}`, padding: '24px 0' }}>
      <div style={{ padding: '0 16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ color: C.orange, fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>
          CHARACTER FORGE
        </div>
        <div style={{ color: C.muted, fontSize: 11 }}>AI · CC4 · HoloSuit · StageOS</div>
      </div>
      <div style={{ paddingTop: 12 }}>
        {FORGE_STEPS.map((step, idx) => {
          const done = completed.has(step.id);
          const active = step.id === current;
          const future = idx > currentIdx && !done;
          return (
            <div key={step.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 16px',
              background: active ? `${C.orange}18` : 'transparent',
              borderLeft: active ? `3px solid ${C.orange}` : '3px solid transparent',
              opacity: future ? 0.4 : 1,
              transition: 'all 0.2s',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? C.green : active ? C.orange : '#1a1a1a',
                color: done || active ? '#000' : C.muted,
                flexShrink: 0, fontSize: 11, fontWeight: 700,
              }}>
                {done ? <CheckCircle2 size={12}/> : stepIcons[step.id]}
              </div>
              <div>
                <div style={{ color: active ? C.orange : done ? C.green : C.text, fontSize: 12, fontWeight: active ? 700 : 500 }}>
                  {step.label}
                </div>
                <div style={{ color: C.muted, fontSize: 10 }}>{step.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step: Upload ─────────────────────────────────────────────────────────────
function StepUpload({
  uploaded, onAdd, onNext,
}: {
  uploaded: Partial<Record<ReferenceImageType, string>>;
  onAdd: (type: ReferenceImageType, dataUrl: string) => void;
  onNext: () => void;
}) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const handleFile = (type: ReferenceImageType, file: File) => {
    const reader = new FileReader();
    reader.onload = e => { if (e.target?.result) onAdd(type, e.target.result as string); };
    reader.readAsDataURL(file);
  };
  const hasFront = !!uploaded['face_front'];
  return (
    <div style={{ padding: 32, maxWidth: 760 }}>
      <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
        Sube referencias del artista
      </h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 28 }}>
        Más imágenes = mayor precisión. Mínimo requerido: foto frontal.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 16, marginBottom: 32 }}>
        {IMAGE_SLOTS.map(slot => {
          const hasImage = !!uploaded[slot.type];
          return (
            <div
              key={slot.type}
              onClick={() => fileRefs.current[slot.type]?.click()}
              style={{
                border: `2px dashed ${hasImage ? C.green : C.border}`,
                borderRadius: 12, padding: 20, cursor: 'pointer',
                background: hasImage ? `${C.green}10` : C.card,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                transition: 'all 0.2s', minHeight: 140, justifyContent: 'center',
                position: 'relative',
              }}
            >
              {hasImage ? (
                <>
                  <img src={uploaded[slot.type]} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }}/>
                  <CheckCircle2 size={16} style={{ color: C.green }} />
                </>
              ) : (
                <>
                  <div style={{ color: C.muted }}>{slot.icon}</div>
                  <Upload size={20} style={{ color: C.muted }} />
                </>
              )}
              <div style={{ color: hasImage ? C.green : C.text, fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
                {slot.label}
              </div>
              <div style={{ color: C.muted, fontSize: 10, textAlign: 'center' }}>{slot.hint}</div>
              <input
                ref={el => { fileRefs.current[slot.type] = el; }}
                type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) handleFile(slot.type, e.target.files[0]); }}
              />
            </div>
          );
        })}
      </div>
      {!hasFront && (
        <div style={{ background: `${C.amber}15`, border: `1px solid ${C.amber}40`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <AlertTriangle size={16} style={{ color: C.amber, flexShrink: 0 }} />
          <span style={{ color: C.amber, fontSize: 13 }}>Se requiere al menos una foto frontal del rostro.</span>
        </div>
      )}
      <button
        onClick={onNext} disabled={!hasFront}
        style={{
          background: hasFront ? C.orange : '#2a2a2a', color: hasFront ? '#000' : C.muted,
          border: 'none', borderRadius: 10, padding: '12px 32px',
          fontWeight: 700, fontSize: 14, cursor: hasFront ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        Analizar con IA <ChevronRight size={16}/>
      </button>
    </div>
  );
}

// ─── Step: Analyzing ──────────────────────────────────────────────────────────
function StepAnalyzing({ progress }: { progress: AnalysisProgressEvent | null }) {
  return (
    <div style={{ padding: 32, maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, margin: 0 }}>Analizando imágenes con IA</h2>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Loader2 size={20} style={{ color: C.orange, animation: 'spin 1s linear infinite' }} />
          <span style={{ color: C.orange, fontWeight: 600 }}>{progress?.stage ?? 'Iniciando…'}</span>
        </div>
        <ProgressBar value={progress?.progress ?? 0} />
        <p style={{ color: C.muted, fontSize: 12, marginTop: 12 }}>{progress?.message ?? 'Preparando modelos…'}</p>
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['Face Detection', 'Facial Landmarks (468 pts)', 'Body Proportions', 'Skin Analysis', 'Hair Classification', 'Style Inference', 'CC4 Identity Generation'].map((s, i) => {
            const pct = progress?.progress ?? 0;
            const done = pct >= (i + 1) * 14;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {done
                  ? <CheckCircle2 size={12} style={{ color: C.green }}/>
                  : pct > i * 14 ? <Loader2 size={12} style={{ color: C.orange, animation: 'spin 1s linear infinite' }}/>
                  : <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#1a1a1a', border: `1px solid ${C.border}` }}/>
                }
                <span style={{ color: done ? C.text : C.muted, fontSize: 12 }}>{s}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Step: Base Character Selection ──────────────────────────────────────────
function StepBaseSelection({
  identity, matchResult, selectedBase, onSelect, onNext, onBack,
}: {
  identity: CharacterIdentity;
  matchResult: BaseCharacterMatch | null;
  selectedBase: string | null;
  onSelect: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div style={{ padding: 32, maxWidth: 820 }}>
      <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Selecciona modelo base CC4</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>
        Todos los modelos usan skeleton <span style={{ color: C.cyan }}>RL_CC3_Plus</span> con <span style={{ color: C.cyan }}>53 huesos RL_*</span>, blendshapes CC4 Extended (228+) y compatibilidad HoloSuit.
      </p>
      {matchResult && (
        <div style={{ background: `${C.orange}10`, border: `1px solid ${C.orange}30`, borderRadius: 10, padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Star size={14} style={{ color: C.orange }}/>
          <span style={{ color: C.orange, fontSize: 12, fontWeight: 600 }}>IA recomienda: </span>
          <span style={{ color: C.text, fontSize: 12 }}>{matchResult.selected_base_character_id} (match {Math.round(matchResult.match_score * 100)}%)</span>
          <span style={{ color: C.muted, fontSize: 11, marginLeft: 6 }}>— {matchResult.reason}</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14, marginBottom: 28 }}>
        {BASE_CHARACTER_LIBRARY.map(base => {
          const isAI   = matchResult?.selected_base_character_id === base.id;
          const isSel  = selectedBase === base.id;
          return (
            <div
              key={base.id}
              onClick={() => onSelect(base.id)}
              style={{
                border: `2px solid ${isSel ? C.orange : isAI ? `${C.orange}50` : C.border}`,
                borderRadius: 12, padding: 18, cursor: 'pointer',
                background: isSel ? `${C.orange}12` : C.card,
                transition: 'all 0.2s', position: 'relative',
              }}
            >
              {isAI && (
                <div style={{ position: 'absolute', top: 10, right: 10, background: C.orange, color: '#000', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>IA</div>
              )}
              <div style={{ width: 56, height: 56, borderRadius: 8, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, border: `1px solid ${C.border}` }}>
                <Users size={24} style={{ color: isSel ? C.orange : C.muted }}/>
              </div>
              <div style={{ color: isSel ? C.orange : C.white, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{base.name}</div>
              <div style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>{base.body_type.replace('_', ' ')} · {base.gender_presentation}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {base.tags.slice(0, 3).map(t => (
                  <span key={t} style={{ background: '#1a1a1a', color: C.muted, fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>{t}</span>
                ))}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <div style={{ background: `${C.green}20`, color: C.green, fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}>HOLOSUIT</div>
                <div style={{ background: `${C.orange}20`, color: C.orange, fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}>STAGEOS</div>
              </div>
              <div style={{ marginTop: 8, color: C.muted, fontSize: 10 }}>{base.polygon_count.toLocaleString()} polígonos · {base.texture_resolution}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onBack} style={{ background: '#1a1a1a', color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChevronLeft size={14}/> Atrás
        </button>
        <button onClick={onNext} disabled={!selectedBase} style={{ background: selectedBase ? C.orange : '#2a2a2a', color: selectedBase ? '#000' : C.muted, border: 'none', borderRadius: 10, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: selectedBase ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 8 }}>
          Generar Morph Profile <ChevronRight size={16}/>
        </button>
      </div>
    </div>
  );
}

// ─── Step: Morph Editor ───────────────────────────────────────────────────────
function StepMorphEditor({
  morphProfile, onChange, onNext, onBack,
}: {
  morphProfile: MorphProfile;
  onChange: (p: MorphProfile) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const setFace = (k: keyof MorphProfile['face_morphs'], v: number) =>
    onChange({ ...morphProfile, face_morphs: { ...morphProfile.face_morphs, [k]: v } });
  const setBody = (k: keyof MorphProfile['body_morphs'], v: number) =>
    onChange({ ...morphProfile, body_morphs: { ...morphProfile.body_morphs, [k]: v } });

  const faceSliders: Array<{ k: keyof MorphProfile['face_morphs']; label: string }> = [
    { k: 'jaw_width',           label: 'Ancho de mandíbula' },
    { k: 'chin_projection',     label: 'Proyección de mentón' },
    { k: 'cheekbone_height',    label: 'Altura de pómulos' },
    { k: 'nose_width',          label: 'Anchura de nariz' },
    { k: 'nose_bridge_height',  label: 'Puente nasal' },
    { k: 'nose_tip_projection', label: 'Punta de nariz' },
    { k: 'eye_spacing',         label: 'Separación de ojos' },
    { k: 'eye_size',            label: 'Tamaño de ojos' },
    { k: 'mouth_width',         label: 'Anchura de boca' },
    { k: 'lip_fullness',        label: 'Volumen de labios' },
  ];
  const bodySliders: Array<{ k: keyof MorphProfile['body_morphs']; label: string }> = [
    { k: 'height',            label: 'Altura' },
    { k: 'shoulder_width',    label: 'Anchura de hombros' },
    { k: 'torso_length',      label: 'Longitud de torso' },
    { k: 'leg_length',        label: 'Longitud de piernas' },
    { k: 'muscle_definition', label: 'Definición muscular' },
  ];

  const MorphSlider = ({ label, value, onChange: onCh }: { label: string; value: number; onChange: (v: number) => void }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: C.text, fontSize: 12 }}>{label}</span>
        <span style={{ color: C.orange, fontSize: 11, fontWeight: 600 }}>{value >= 0 ? '+' : ''}{(value * 100).toFixed(0)}%</span>
      </div>
      <input type="range" min={-25} max={25} value={Math.round(value * 100)}
        onChange={e => onCh(parseInt(e.target.value) / 100)}
        style={{ width: '100%', accentColor: C.orange, cursor: 'pointer' }}
      />
    </div>
  );

  return (
    <div style={{ padding: 32, maxWidth: 760 }}>
      <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Morph Profile Editor</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 8 }}>
        Ajusta la apariencia del personaje. El skeleton, skin weights y blendshapes permanecen{' '}
        <span style={{ color: C.green }}>bloqueados</span>.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['skeleton', 'skin_weights', 'facial_blendshapes', 'hand_rig'] as const).map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${C.green}15`, border: `1px solid ${C.green}30`, borderRadius: 6, padding: '3px 8px' }}>
            <Lock size={10} style={{ color: C.green }}/>
            <span style={{ color: C.green, fontSize: 10, fontWeight: 600 }}>{k.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ color: C.orange, fontSize: 12, fontWeight: 700, marginBottom: 16, letterSpacing: 1 }}>ROSTRO</div>
          {faceSliders.map(s => (
            <MorphSlider key={s.k} label={s.label} value={morphProfile.face_morphs[s.k]} onChange={v => setFace(s.k, v)}/>
          ))}
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ color: C.cyan, fontSize: 12, fontWeight: 700, marginBottom: 16, letterSpacing: 1 }}>CUERPO</div>
          {bodySliders.map(s => (
            <MorphSlider key={s.k} label={s.label} value={morphProfile.body_morphs[s.k]} onChange={v => setBody(s.k, v)}/>
          ))}
          <div style={{ marginTop: 20, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 600, marginBottom: 12, letterSpacing: 1 }}>ESTILO</div>
            <MorphSlider label="Nivel de estilización" value={morphProfile.style_morphs.stylization_level}
              onChange={v => onChange({ ...morphProfile, style_morphs: { ...morphProfile.style_morphs, stylization_level: Math.max(0, Math.min(1, (v + 0.25) * 2)) } })}
            />
            <MorphSlider label="Exageración escénica" value={morphProfile.style_morphs.stage_exaggeration_level}
              onChange={v => onChange({ ...morphProfile, style_morphs: { ...morphProfile.style_morphs, stage_exaggeration_level: Math.max(0, Math.min(1, (v + 0.25) * 2)) } })}
            />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button onClick={onBack} style={{ background: '#1a1a1a', color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChevronLeft size={14}/> Atrás
        </button>
        <button onClick={onNext} style={{ background: C.orange, color: '#000', border: 'none', borderRadius: 10, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          Continuar <ChevronRight size={16}/>
        </button>
      </div>
    </div>
  );
}

// ─── Step: Texture / Hair / Wardrobe ─────────────────────────────────────────
const HAIR_PRESETS = ['Curly Short','Afro Medium','Straight Long','Waves Medium','Buzzcut','Locs Short','Dreadlocks'];
const WARDROBE_PRESETS = ['Futuristic Stage','Urban Street','Classic Formal','Caribbean Fusion','All Black','Techwear','Custom'];
const SKIN_TONES = ['fair','light_medium','medium','medium_warm','medium_dark','dark','deep'];

function StepTexture({
  onNext, onBack,
  skinTone, setSkinTone,
  hair, setHair,
  wardrobe, setWardrobe,
}: {
  onNext: () => void; onBack: () => void;
  skinTone: string; setSkinTone: (s: string) => void;
  hair: string; setHair: (s: string) => void;
  wardrobe: string; setWardrobe: (s: string) => void;
}) {
  const TONE_HEX: Record<string, string> = {
    fair: '#f5d6b8', light_medium: '#e8b98e', medium: '#d4906a',
    medium_warm: '#c07548', medium_dark: '#9a5a2e', dark: '#6b3a1f', deep: '#3d1f0d',
  };
  return (
    <div style={{ padding: 32, maxWidth: 760 }}>
      <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Textura · Cabello · Ropa</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 28 }}>Personaliza el look visual del artista.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Skin tone */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ color: C.orange, fontSize: 12, fontWeight: 700, marginBottom: 14, letterSpacing: 1 }}>TONO DE PIEL</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {SKIN_TONES.map(t => (
              <div key={t} onClick={() => setSkinTone(t)} style={{
                width: 44, height: 44, borderRadius: 8, background: TONE_HEX[t], cursor: 'pointer',
                border: `3px solid ${skinTone === t ? C.orange : 'transparent'}`,
                boxShadow: skinTone === t ? `0 0 12px ${C.orange}60` : 'none',
                transition: 'all 0.15s',
              }} title={t.replace('_', ' ')} />
            ))}
          </div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 10 }}>Seleccionado: <span style={{ color: C.text }}>{skinTone.replace('_', ' ')}</span></div>
        </div>
        {/* Hair */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ color: C.cyan, fontSize: 12, fontWeight: 700, marginBottom: 14, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Scissors size={13}/> CABELLO
            <span style={{ background: `${C.amber}20`, color: C.amber, fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>HIGH RISK — Validate before StageOS</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {HAIR_PRESETS.map(h => (
              <button key={h} onClick={() => setHair(h)} style={{
                background: hair === h ? `${C.cyan}20` : '#1a1a1a',
                border: `1px solid ${hair === h ? C.cyan : C.border}`,
                color: hair === h ? C.cyan : C.text, fontSize: 12, padding: '6px 14px',
                borderRadius: 8, cursor: 'pointer', fontWeight: hair === h ? 700 : 400,
              }}>{h}</button>
            ))}
          </div>
        </div>
        {/* Wardrobe */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ color: '#a855f7', fontSize: 12, fontWeight: 700, marginBottom: 14, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Shirt size={13}/> VESTUARIO
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {WARDROBE_PRESETS.map(w => (
              <button key={w} onClick={() => setWardrobe(w)} style={{
                background: wardrobe === w ? '#a855f720' : '#1a1a1a',
                border: `1px solid ${wardrobe === w ? '#a855f7' : C.border}`,
                color: wardrobe === w ? '#a855f7' : C.text, fontSize: 12, padding: '6px 14px',
                borderRadius: 8, cursor: 'pointer', fontWeight: wardrobe === w ? 700 : 400,
              }}>{w}</button>
            ))}
          </div>
        </div>
        {/* Texture variants info */}
        <div style={{ background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: 'flex', gap: 16 }}>
          {[
            { label: 'Hero Texture', res: '4K', use: 'Renders & videos', color: C.orange },
            { label: 'Live Hologram', res: '2K', use: 'StageOS + alto contraste', color: C.cyan },
            { label: 'Web Preview', res: '1K', use: 'Editor Boostify', color: C.green },
          ].map(v => (
            <div key={v.label} style={{ flex: 1, textAlign: 'center', padding: '10px 0' }}>
              <div style={{ color: v.color, fontWeight: 700, fontSize: 12 }}>{v.label}</div>
              <div style={{ color: C.white, fontSize: 18, fontWeight: 800, margin: '4px 0' }}>{v.res}</div>
              <div style={{ color: C.muted, fontSize: 10 }}>{v.use}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
        <button onClick={onBack} style={{ background: '#1a1a1a', color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChevronLeft size={14}/> Atrás
        </button>
        <button onClick={onNext} style={{ background: C.orange, color: '#000', border: 'none', borderRadius: 10, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          Validar Rig <ChevronRight size={16}/>
        </button>
      </div>
    </div>
  );
}

// ─── Step: Rig Validation ─────────────────────────────────────────────────────
function StepRigValidation({
  validating, result, progress, onNext, onBack,
}: {
  validating: boolean;
  result: RigValidationResult | null;
  progress: AnalysisProgressEvent | null;
  onNext: () => void;
  onBack: () => void;
}) {
  const checks = result ? [
    { label: 'Skeleton detectado',      ok: result.skeleton_detected },
    { label: `${result.bone_count} huesos RL_*`, ok: result.required_bones_present },
    { label: 'Skin weights válidos',    ok: result.skin_weights_valid },
    { label: `${result.blendshape_count} blendshapes CC4`, ok: result.blendshapes_valid },
    { label: 'Hand rig (30 dedos)',     ok: result.hand_rig_valid },
    { label: 'Face rig (CC4 Extended)', ok: result.face_rig_valid },
    { label: 'Eye bones',               ok: result.eye_bones_valid },
    { label: 'Jaw bone',                ok: result.jaw_bone_valid },
    { label: 'T-pose válida',           ok: result.t_pose_valid },
    { label: 'Scale correcto',          ok: result.scale_valid },
    { label: 'HoloSuit Ready',            ok: result.holosuit_ready },
  ] : [];

  return (
    <div style={{ padding: 32, maxWidth: 700 }}>
      <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Rig Preservation Validator</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>
        Verifica que el skeleton, skin weights y blendshapes CC4 permanezcan intactos.
      </p>
      {validating && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Loader2 size={18} style={{ color: C.orange, animation: 'spin 1s linear infinite' }}/>
            <span style={{ color: C.orange, fontWeight: 600 }}>{progress?.message ?? 'Validando…'}</span>
          </div>
          <ProgressBar value={progress?.progress ?? 0} />
        </div>
      )}
      {result && (
        <>
          <div style={{
            background: result.rig_status === 'valid' ? `${C.green}15` : result.rig_status === 'valid_with_warnings' ? `${C.amber}10` : `${C.red}10`,
            border: `1px solid ${result.rig_status === 'valid' ? C.green : result.rig_status === 'valid_with_warnings' ? C.amber : C.red}40`,
            borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {result.rig_status === 'valid' ? <CheckCircle2 size={18} style={{ color: C.green }}/> :
             result.rig_status === 'valid_with_warnings' ? <AlertTriangle size={18} style={{ color: C.amber }}/> :
             <XCircle size={18} style={{ color: C.red }}/>}
            <span style={{ color: result.rig_status === 'valid' ? C.green : result.rig_status === 'valid_with_warnings' ? C.amber : C.red, fontWeight: 700 }}>
              {result.rig_status === 'valid' ? 'RIG VÁLIDO — Listo para StageOS' :
               result.rig_status === 'valid_with_warnings' ? 'RIG VÁLIDO con advertencias' : 'RIG INVÁLIDO — Revisar errores'}
            </span>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {checks.map(c => (
                <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {c.ok ? <CheckCircle2 size={14} style={{ color: C.green }}/> : <XCircle size={14} style={{ color: C.red }}/>}
                  <span style={{ color: c.ok ? C.text : C.red, fontSize: 12 }}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
          {result.issues.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {result.issues.map((issue, i) => (
                <div key={i} style={{
                  background: issue.severity === 'critical' || issue.severity === 'high' ? `${C.red}10` : issue.severity === 'medium' ? `${C.amber}10` : `${C.cyan}10`,
                  border: `1px solid ${issue.severity === 'critical' || issue.severity === 'high' ? C.red : issue.severity === 'medium' ? C.amber : C.cyan}40`,
                  borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start',
                }}>
                  <AlertTriangle size={14} style={{ color: issue.severity === 'medium' ? C.amber : C.cyan, flexShrink: 0, marginTop: 2 }}/>
                  <div>
                    <span style={{ color: C.amber, fontSize: 11, fontWeight: 700, marginRight: 6 }}>[{issue.area.toUpperCase()}]</span>
                    <span style={{ color: C.text, fontSize: 12 }}>{issue.message}</span>
                    {issue.auto_fixable && <span style={{ color: C.green, fontSize: 10, marginLeft: 6 }}>✓ auto-fixable</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onBack} style={{ background: '#1a1a1a', color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChevronLeft size={14}/> Atrás
        </button>
        <button onClick={onNext} disabled={!result} style={{ background: result ? C.orange : '#2a2a2a', color: result ? '#000' : C.muted, border: 'none', borderRadius: 10, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: result ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 8 }}>
          HoloSuit Compatibility <ChevronRight size={16}/>
        </button>
      </div>
    </div>
  );
}

// ─── Step: HoloSuit ─────────────────────────────────────────────────────────────
function StepHoloSuit({
  building, profile, progress, onNext, onBack,
}: {
  building: boolean;
  profile: HoloSuitCompatibilityProfile | null;
  progress: AnalysisProgressEvent | null;
  onNext: () => void;
  onBack: () => void;
}) {
  const [showMap, setShowMap] = useState<'body' | 'hand' | 'face'>('body');
  const mapData = profile ? (showMap === 'body' ? profile.body_map : showMap === 'hand' ? profile.hand_map : profile.face_map) : {};

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>HoloSuit Compatibility Profile</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>
        Avatar UID: <span style={{ color: C.cyan }}>RL_CC3_Plus</span> · Bone UID: <span style={{ color: C.cyan }}>RL_Motion_Bone</span> · UDP: <span style={{ color: C.green }}>14043</span> · 60fps
      </p>
      {building && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Loader2 size={18} style={{ color: C.orange, animation: 'spin 1s linear infinite' }}/>
            <span style={{ color: C.orange, fontWeight: 600 }}>{progress?.message ?? 'Building…'}</span>
          </div>
          <ProgressBar value={progress?.progress ?? 0} />
        </div>
      )}
      {profile && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {((['body','hand','face'] as const)).map(t => (
              <button key={t} onClick={() => setShowMap(t)} style={{
                background: showMap === t ? `${C.orange}20` : '#1a1a1a',
                border: `1px solid ${showMap === t ? C.orange : C.border}`,
                color: showMap === t ? C.orange : C.text, fontSize: 12, padding: '6px 14px',
                borderRadius: 8, cursor: 'pointer', fontWeight: showMap === t ? 700 : 400,
              }}>{t === 'body' ? 'Body (21)' : t === 'hand' ? 'Hands (30)' : 'Face (19)'}</button>
            ))}
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20, maxHeight: 280, overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {Object.entries(mapData).map(([rok, cc4]) => (
                <div key={rok} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${C.border}20` }}>
                  <span style={{ color: '#6366f1', fontSize: 11, minWidth: 160 }}>{rok}</span>
                  <ChevronRight size={10} style={{ color: C.muted, flexShrink: 0 }}/>
                  <span style={{ color: C.orange, fontSize: 11 }}>{cc4}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Body', enabled: profile.streaming.body_enabled, count: Object.keys(profile.body_map).length },
              { label: 'Hands', enabled: profile.streaming.hands_enabled, count: Object.keys(profile.hand_map).length },
              { label: 'Face', enabled: profile.streaming.face_enabled, count: Object.keys(profile.face_map).length },
            ].map(s => (
              <div key={s.label} style={{ background: s.enabled ? `${C.green}10` : '#1a1a1a', border: `1px solid ${s.enabled ? C.green : C.border}30`, borderRadius: 10, padding: 14, textAlign: 'center' }}>
                <div style={{ color: s.enabled ? C.green : C.muted, fontWeight: 700, fontSize: 13 }}>{s.label}</div>
                <div style={{ color: C.white, fontSize: 20, fontWeight: 800 }}>{s.count}</div>
                <div style={{ color: C.muted, fontSize: 10 }}>bones mapped</div>
                {s.enabled && <div style={{ background: C.green, color: '#000', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginTop: 4 }}>ENABLED</div>}
              </div>
            ))}
          </div>
          <div style={{ background: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={16} style={{ color: C.green }}/>
            <span style={{ color: C.green, fontWeight: 700 }}>HOLOSUIT READY</span>
            <span style={{ color: C.muted, fontSize: 12 }}>— Scale: ×{profile.calibration.scale_factor.toFixed(2)} · {profile.calibration.pose} · Height: {Math.round(profile.calibration.height_cm)}cm</span>
          </div>
        </>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button onClick={onBack} style={{ background: '#1a1a1a', color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChevronLeft size={14}/> Atrás
        </button>
        <button onClick={onNext} disabled={!profile} style={{ background: profile ? C.orange : '#2a2a2a', color: profile ? '#000' : C.muted, border: 'none', borderRadius: 10, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: profile ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 8 }}>
          Quality Report <ChevronRight size={16}/>
        </button>
      </div>
    </div>
  );
}

// ─── Step: Quality Report ─────────────────────────────────────────────────────
function StepQuality({
  report, onNext, onBack,
}: { report: CharacterQualityReport | null; onNext: () => void; onBack: () => void }) {
  if (!report) return <div style={{ padding: 32, color: C.muted }}>Generando reporte…</div>;
  const metrics = [
    { label: 'Likeness',      v: report.likeness_score },
    { label: 'Rig',           v: report.rig_score },
    { label: 'Texture',       v: report.texture_score },
    { label: 'Hair',          v: report.hair_score },
    { label: 'Wardrobe',      v: report.wardrobe_score },
    { label: 'Blendshapes',   v: report.blendshape_score },
    { label: 'HoloSuit',        v: report.holosuit_score },
    { label: 'Hologram',      v: report.hologram_score },
    { label: 'Performance',   v: report.performance_score },
    { label: 'Optimization',  v: report.optimization_score },
  ];
  const canExport = report.character_quality_score >= 70;
  return (
    <div style={{ padding: 32, maxWidth: 760 }}>
      <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Character Quality Report</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>Score mínimo para StageOS: <span style={{ color: C.orange }}>70</span></p>
      <div style={{ display: 'flex', gap: 24, marginBottom: 28 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 160 }}>
          <ScoreRing score={report.character_quality_score} size={100} />
          <div style={{ color: scoreColor(report.character_quality_score), fontWeight: 700, fontSize: 13 }}>
            {scoreLabel(report.character_quality_score)}
          </div>
          <div style={{
            background: canExport ? `${C.green}20` : `${C.red}20`,
            border: `1px solid ${canExport ? C.green : C.red}40`,
            color: canExport ? C.green : C.red, fontSize: 11, fontWeight: 700,
            padding: '3px 10px', borderRadius: 6, marginTop: 4,
          }}>
            {report.status === 'stageos_ready' ? '✓ STAGEOS READY' :
             report.status === 'stageos_ready_with_warnings' ? '⚠ READY + WARNINGS' : '✗ NOT READY'}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {metrics.map(m => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: C.muted, fontSize: 11, minWidth: 90 }}>{m.label}</span>
              <div style={{ flex: 1 }}><ProgressBar value={m.v} color={scoreColor(m.v)} /></div>
              <span style={{ color: scoreColor(m.v), fontSize: 11, fontWeight: 700, minWidth: 28 }}>{m.v}</span>
            </div>
          ))}
        </div>
      </div>
      {report.issues.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {report.issues.map((issue, i) => (
            <div key={i} style={{
              background: `${C.amber}08`, border: `1px solid ${C.amber}30`,
              borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8,
            }}>
              <AlertTriangle size={13} style={{ color: C.amber, flexShrink: 0, marginTop: 2 }}/>
              <span style={{ color: C.text, fontSize: 12 }}>
                <span style={{ color: C.amber, fontWeight: 700 }}>[{issue.area}] </span>{issue.message}
              </span>
            </div>
          ))}
        </div>
      )}
      {!canExport && (
        <div style={{ background: `${C.red}10`, border: `1px solid ${C.red}40`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 8 }}>
          <XCircle size={14} style={{ color: C.red, flexShrink: 0 }}/>
          <span style={{ color: C.red, fontSize: 12 }}>Score insuficiente para StageOS (mínimo 70). Agrega más referencias o ajusta los morphs.</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onBack} style={{ background: '#1a1a1a', color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChevronLeft size={14}/> Atrás
        </button>
        <button onClick={onNext} disabled={!canExport} style={{ background: canExport ? C.orange : '#2a2a2a', color: canExport ? '#000' : C.muted, border: 'none', borderRadius: 10, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: canExport ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 8 }}>
          Crear Variantes <ChevronRight size={16}/>
        </button>
      </div>
    </div>
  );
}

// ─── Step: Variants ───────────────────────────────────────────────────────────
function StepVariants({
  variants, onNext, onBack,
}: { variants: CharacterVariant[]; onNext: () => void; onBack: () => void }) {
  const icons: Record<string, React.ReactNode> = {
    hero:          <Film size={18}/>,
    live_hologram: <Zap size={18}/>,
    web_preview:   <Globe size={18}/>,
  };
  const colors: Record<string, string> = { hero: C.orange, live_hologram: C.cyan, web_preview: C.green };
  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Character Variants</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>3 variantes generadas automáticamente desde el modelo base CC4.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginBottom: 28 }}>
        {variants.map(v => {
          const col = colors[v.type];
          return (
            <div key={v.type} style={{ background: C.card, border: `2px solid ${col}40`, borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: col }}>{icons[v.type]}</div>
                <div style={{ color: col, fontWeight: 700, fontSize: 14 }}>{v.label}</div>
              </div>
              <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>{v.description}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {v.use_case.map(u => (
                  <div key={u} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={11} style={{ color: col }}/>
                    <span style={{ color: C.text, fontSize: 11 }}>{u}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.muted, fontSize: 11 }}>Polígonos</span>
                  <span style={{ color: C.text, fontSize: 11, fontWeight: 600 }}>{v.polygon_count.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.muted, fontSize: 11 }}>Textura</span>
                  <span style={{ color: C.text, fontSize: 11, fontWeight: 600 }}>{v.texture_resolution}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.muted, fontSize: 11 }}>Tamaño</span>
                  <span style={{ color: C.text, fontSize: 11, fontWeight: 600 }}>{v.file_size_mb} MB</span>
                </div>
              </div>
              {v.ready && <div style={{ background: `${col}20`, color: col, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, textAlign: 'center' }}>✓ LISTO</div>}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onBack} style={{ background: '#1a1a1a', color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChevronLeft size={14}/> Atrás
        </button>
        <button onClick={onNext} style={{ background: C.orange, color: '#000', border: 'none', borderRadius: 10, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          Exportar a StageOS <Send size={16}/>
        </button>
      </div>
    </div>
  );
}

// ─── Step: Export ─────────────────────────────────────────────────────────────
function StepExport({
  exporting, pkg, progress, onBack, onRestart,
}: {
  exporting: boolean;
  pkg: StageOSCharacterPackage | null;
  progress: AnalysisProgressEvent | null;
  onBack: () => void;
  onRestart: () => void;
}) {
  return (
    <div style={{ padding: 32, maxWidth: 720 }}>
      <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>StageOS Character Package</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>Exportando personaje al sistema de shows en vivo.</p>
      {exporting && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Loader2 size={18} style={{ color: C.orange, animation: 'spin 1s linear infinite' }}/>
            <span style={{ color: C.orange, fontWeight: 600 }}>{progress?.message ?? 'Exportando…'}</span>
          </div>
          <ProgressBar value={progress?.progress ?? 0} />
        </div>
      )}
      {pkg && (
        <>
          <div style={{ background: `${C.green}10`, border: `1px solid ${C.green}40`, borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle2 size={20} style={{ color: C.green }}/>
            <div>
              <div style={{ color: C.green, fontWeight: 700 }}>CHARACTER ENVIADO A STAGEOS</div>
              <div style={{ color: C.muted, fontSize: 12 }}>Package v{pkg.version} · {new Date(pkg.created_at).toLocaleString()}</div>
            </div>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ color: C.orange, fontSize: 11, fontWeight: 700, marginBottom: 14, letterSpacing: 1 }}>PACKAGE CONTENTS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Hero Character',      val: pkg.variants.hero,          color: C.orange },
                { label: 'Live Hologram',       val: pkg.variants.live_hologram, color: C.cyan },
                { label: 'Web Preview',         val: pkg.variants.web_preview,   color: C.green },
                { label: 'Morph Profile',       val: pkg.profiles.morph_profile, color: C.muted },
                { label: 'Rig Profile',         val: pkg.profiles.rig_profile,   color: C.muted },
                { label: 'HoloSuit Profile',      val: pkg.profiles.holosuit_profile,color: '#6366f1' },
                { label: 'Hologram Profile',    val: pkg.profiles.hologram_profile,color: C.muted },
                { label: 'Quality Report',      val: pkg.quality_report,         color: C.muted },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', gap: 10, alignItems: 'center', borderBottom: `1px solid ${C.border}20`, paddingBottom: 6 }}>
                  <span style={{ color: C.muted, fontSize: 11, minWidth: 130 }}>{r.label}</span>
                  <span style={{ color: r.color, fontSize: 11, fontFamily: 'monospace' }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
            {[
              { l: 'Avatar UID', v: pkg.source.avatar_uid, c: C.cyan },
              { l: 'HoloSuit Ready', v: pkg.stageos_ready ? '✓' : '✗', c: C.green },
              { l: 'Face Blendshapes', v: `${Object.keys(pkg.face_blendshape_map).length}`, c: C.orange },
              { l: 'Hand Bones', v: `${Object.keys(pkg.hand_map).length}`, c: C.orange },
            ].map(b => (
              <div key={b.l} style={{ background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                <div style={{ color: C.muted, fontSize: 10 }}>{b.l}</div>
                <div style={{ color: b.c, fontWeight: 700, fontSize: 14 }}>{b.v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onRestart} style={{ background: '#1a1a1a', color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 24px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <RefreshCw size={14}/> Nuevo Character
            </button>
            <button style={{ background: `${C.green}20`, color: C.green, border: `1px solid ${C.green}40`, borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={16}/> Abrir en StageOS
            </button>
            <button style={{ background: `${C.orange}20`, color: C.orange, border: `1px solid ${C.orange}40`, borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Download size={16}/> Descargar Package
            </button>
          </div>
        </>
      )}
      {!exporting && !pkg && (
        <button onClick={onBack} style={{ background: '#1a1a1a', color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChevronLeft size={14}/> Atrás
        </button>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function CharacterForgeDashboard() {
  const [step, setStep] = useState<ForgeStep>('upload');
  const [completed, setCompleted] = useState<Set<ForgeStep>>(new Set());
  const [progress, setProgress] = useState<AnalysisProgressEvent | null>(null);

  // State per step
  const [uploaded, setUploaded] = useState<Partial<Record<ReferenceImageType, string>>>({});
  const [identity, setIdentity] = useState<CharacterIdentity | null>(null);
  const [matchResult, setMatchResult] = useState<BaseCharacterMatch | null>(null);
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [morphProfile, setMorphProfile] = useState<MorphProfile | null>(null);
  const [skinTone, setSkinTone] = useState('medium_warm');
  const [hair, setHair] = useState('Curly Short');
  const [wardrobe, setWardrobe] = useState('Futuristic Stage');
  const [rigResult, setRigResult] = useState<RigValidationResult | null>(null);
  const [rigValidating, setRigValidating] = useState(false);
  const [holosuitProfile, setHoloSuitProfile] = useState<HoloSuitCompatibilityProfile | null>(null);
  const [holosuitBuilding, setHoloSuitBuilding] = useState(false);
  const [qualityReport, setQualityReport] = useState<CharacterQualityReport | null>(null);
  const [variants, setVariants] = useState<CharacterVariant[]>([]);
  const [stagePkg, setStagePkg] = useState<StageOSCharacterPackage | null>(null);
  const [exporting, setExporting] = useState(false);

  // AI Preview state
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const characterId = useRef(`char_${Date.now()}`);
  const artistId    = useRef('artist_preview');

  const markDone = (s: ForgeStep) => setCompleted(prev => new Set([...prev, s]));

  const generateCharacterPreview = useCallback(async () => {
    setGeneratingPreview(true);
    setPreviewError(null);
    try {
      const description = identity
        ? `${(identity as any).face_analysis?.face_shape ?? 'oval'} face, ${(identity as any).physical_appearance?.body_type ?? 'athletic'} build`
        : 'athletic build, confident stage performer';
      const res = await fetch('/api/character-forge/generate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_description: description,
          skin_tone: skinTone,
          hair_style: hair,
          wardrobe: wardrobe,
          gender: (identity as any)?.demographics?.gender_presentation ?? 'male',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewImage(data.data.image_url);
      } else {
        setPreviewError(data.error ?? 'Generation failed');
      }
    } catch (e: any) {
      setPreviewError(e.message);
    } finally {
      setGeneratingPreview(false);
    }
  }, [identity, skinTone, hair, wardrobe]);

  // --- Handlers ---

  const handleUploadNext = () => {
    const uploadList = Object.entries(uploaded).map(([t, d]) => ({ type: t as ReferenceImageType, dataUrl: d! }));
    setStep('analyzing');
    analyzeArtistImages(artistId.current, uploadList, e => setProgress(e)).then(id => {
      setIdentity(id);
      const match = matchBaseCharacter(id);
      setMatchResult(match);
      setSelectedBase(match.selected_base_character_id);
      markDone('upload');
      markDone('analyzing');
      setStep('base_selection');
    });
  };

  const handleBaseNext = () => {
    if (!identity || !selectedBase) return;
    const mp = generateMorphProfile(identity, selectedBase);
    setMorphProfile(mp);
    markDone('base_selection');
    setStep('morph_editor');
  };

  const handleMorphNext = () => {
    markDone('morph_editor');
    setStep('texture_hair');
  };

  const handleTextureNext = () => {
    markDone('texture_hair');
    setStep('rig_validation');
    setRigValidating(true);
    validateRig(characterId.current, selectedBase ?? '', e => setProgress(e)).then(r => {
      setRigResult(r);
      setRigValidating(false);
    });
  };

  const handleRigNext = () => {
    if (!identity) return;
    markDone('rig_validation');
    setStep('holosuit');
    setHoloSuitBuilding(true);
    buildHoloSuitProfile(characterId.current, identity, e => setProgress(e)).then(p => {
      setHoloSuitProfile(p);
      setHoloSuitBuilding(false);
    });
  };

  const handleHoloSuitNext = () => {
    if (!identity || !rigResult || !holosuitProfile) return;
    const report = generateQualityReport(characterId.current, identity, rigResult, holosuitProfile);
    setQualityReport(report);
    markDone('holosuit');
    setStep('quality');
  };

  const handleQualityNext = () => {
    const v = buildCharacterVariants(characterId.current, selectedBase ?? '');
    setVariants(v);
    markDone('quality');
    setStep('variants');
  };

  const handleVariantsNext = () => {
    if (!qualityReport) return;
    markDone('variants');
    setStep('export');
    setExporting(true);
    const charStub: GeneratedCharacter = {
      id:                characterId.current,
      artist_id:         artistId.current,
      base_character_id: selectedBase ?? '',
      name:              'AI Character',
      status:            'ready',
      current_version:   '1.0.0',
      quality_score:     qualityReport.character_quality_score,
      stageos_ready:     qualityReport.character_quality_score >= 70,
      holosuit_ready:      !!holosuitProfile?.ready,
      quality_report:    qualityReport,
      created_at:        new Date().toISOString(),
      updated_at:        new Date().toISOString(),
    };
    exportToStageOS(charStub, e => setProgress(e)).then(pkg => {
      setStagePkg(pkg);
      setExporting(false);
      markDone('export');
    });
  };

  const handleRestart = () => {
    setStep('upload');
    setCompleted(new Set());
    setUploaded({});
    setIdentity(null);
    setMatchResult(null);
    setSelectedBase(null);
    setMorphProfile(null);
    setRigResult(null);
    setRigValidating(false);
    setHoloSuitProfile(null);
    setHoloSuitBuilding(false);
    setQualityReport(null);
    setVariants([]);
    setStagePkg(null);
    setExporting(false);
    characterId.current = `char_${Date.now()}`;
  };

  // ─── Render step content ──────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case 'upload':
        return <StepUpload uploaded={uploaded} onAdd={(t, d) => setUploaded(p => ({ ...p, [t]: d }))} onNext={handleUploadNext}/>;
      case 'analyzing':
        return <StepAnalyzing progress={progress}/>;
      case 'base_selection':
        return identity ? (
          <StepBaseSelection
            identity={identity} matchResult={matchResult} selectedBase={selectedBase}
            onSelect={setSelectedBase} onNext={handleBaseNext}
            onBack={() => setStep('upload')}
          />
        ) : null;
      case 'morph_editor':
        return morphProfile ? (
          <StepMorphEditor morphProfile={morphProfile} onChange={setMorphProfile} onNext={handleMorphNext} onBack={() => setStep('base_selection')}/>
        ) : null;
      case 'texture_hair':
        return (
          <StepTexture
            onNext={handleTextureNext} onBack={() => setStep('morph_editor')}
            skinTone={skinTone} setSkinTone={setSkinTone}
            hair={hair} setHair={setHair}
            wardrobe={wardrobe} setWardrobe={setWardrobe}
          />
        );
      case 'rig_validation':
        return (
          <StepRigValidation validating={rigValidating} result={rigResult} progress={progress}
            onNext={handleRigNext} onBack={() => setStep('texture_hair')}/>
        );
      case 'holosuit':
        return (
          <StepHoloSuit building={holosuitBuilding} profile={holosuitProfile} progress={progress}
            onNext={handleHoloSuitNext} onBack={() => setStep('rig_validation')}/>
        );
      case 'quality':
        return <StepQuality report={qualityReport} onNext={handleQualityNext} onBack={() => setStep('holosuit')}/>;
      case 'variants':
        return <StepVariants variants={variants} onNext={handleVariantsNext} onBack={() => setStep('quality')}/>;
      case 'export':
        return (
          <StepExport exporting={exporting} pkg={stagePkg} progress={progress}
            onBack={() => setStep('variants')} onRestart={handleRestart}/>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${C.orange}, #fb923c)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Cpu size={16} style={{ color: '#000' }}/>
          </div>
          <div>
            <div style={{ color: C.white, fontWeight: 800, fontSize: 15, letterSpacing: 0.5 }}>BOOSTIFY AI CHARACTER FORGE</div>
            <div style={{ color: C.muted, fontSize: 11 }}>Character Creator Morph Engine · CC4 · HoloSuit · StageOS</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green }}/>
            <span style={{ color: C.muted, fontSize: 11 }}>RL_CC3_Plus</span>
          </div>
          <div style={{ background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1' }}/>
            <span style={{ color: C.muted, fontSize: 11 }}>HoloSuit UDP:14043</span>
          </div>
          <div style={{ background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.orange }}/>
            <span style={{ color: C.muted, fontSize: 11 }}>MVP 1</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', height: 'calc(100vh - 69px)' }}>
        <StepSidebar current={step} completed={completed}/>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {renderStep()}
        </div>

        {/* Right AI Preview Panel */}
        <div style={{ width: 260, flexShrink: 0, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', padding: 20, gap: 14, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={13} style={{ color: C.orange }}/>
            <span style={{ color: C.orange, fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>AI PREVIEW</span>
          </div>

          {/* Image area */}
          <div style={{
            width: '100%', aspectRatio: '3/4', borderRadius: 12, overflow: 'hidden',
            border: `1px solid ${previewImage ? C.orange + '40' : C.border}`,
            background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', flexShrink: 0,
          }}>
            {generatingPreview ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Loader2 size={24} style={{ color: C.orange, animation: 'spin 1s linear infinite' }}/>
                <span style={{ color: C.muted, fontSize: 11 }}>Generating…</span>
              </div>
            ) : previewImage ? (
              <>
                <img src={previewImage} alt="AI Character Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, background: '#00000088', borderRadius: 6, padding: '4px 8px', backdropFilter: 'blur(4px)' }}>
                  <div style={{ color: C.orange, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>FLUX PRO · GENERATED</div>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16, textAlign: 'center' }}>
                <ImageOff size={28} style={{ color: '#2a2a2a' }}/>
                <span style={{ color: C.muted, fontSize: 11 }}>Generate an AI character preview below</span>
              </div>
            )}
          </div>

          {previewError && (
            <div style={{ background: `${C.red}10`, border: `1px solid ${C.red}30`, borderRadius: 8, padding: '8px 10px', color: C.red, fontSize: 11 }}>
              {previewError}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={generateCharacterPreview}
            disabled={generatingPreview}
            style={{
              background: generatingPreview ? '#1a1a1a' : `linear-gradient(135deg, ${C.orange}, #fb923c)`,
              color: generatingPreview ? C.muted : '#000',
              border: 'none', borderRadius: 10, padding: '10px 12px',
              fontWeight: 700, fontSize: 12, cursor: generatingPreview ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <Sparkles size={13}/>
            {generatingPreview ? 'Generating…' : previewImage ? 'Regenerate Preview' : 'Generate AI Preview'}
          </button>

          {previewImage && (
            <a
              href={previewImage}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#1a1a1a', color: C.text, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '7px 12px', fontWeight: 600, fontSize: 11,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                textDecoration: 'none',
              }}
            >
              <Eye size={12}/> View Full Size
            </a>
          )}

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ color: C.muted, fontSize: 10, fontWeight: 600, letterSpacing: 1, marginBottom: 2 }}>MODEL</div>
            <div style={{ color: C.text, fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }}/>
              Flux Pro · text-to-image
            </div>
            <div style={{ color: C.muted, fontSize: 10 }}>28 steps · portrait 3:4 · guidance 3.5</div>
          </div>

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ color: C.muted, fontSize: 10, fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>CURRENT SETTINGS</div>
            {[
              { label: 'Skin', value: skinTone.replace(/_/g, ' ') },
              { label: 'Hair', value: hair },
              { label: 'Wardrobe', value: wardrobe },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: C.muted, fontSize: 10 }}>{s.label}</span>
                <span style={{ color: C.text, fontSize: 10, fontWeight: 600 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input[type=range] { -webkit-appearance: none; height: 4px; background: #1a1a1a; border-radius: 2px; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #f97316; cursor: pointer; }
      `}</style>
    </div>
  );
}

export default CharacterForgeDashboard;
