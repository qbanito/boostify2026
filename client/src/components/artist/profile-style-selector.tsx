import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { profileVisualStyle, type ProfileVisualStyle } from '../../../../shared/profile-visual-styles';
export { profileVisualStyle, type ProfileVisualStyle };

const options: { id: ProfileVisualStyle; name: string; description: string }[] = [
  { id: 'classic', name: 'Classic', description: 'Your familiar profile.' },
  { id: 'spotlight', name: 'Spotlight', description: 'A cinematic, focused stage.' },
  { id: 'editorial', name: 'Editorial', description: 'A refined magazine feel.' },
  { id: 'aurora', name: 'Aurora', description: 'Luminous violet and blue.' },
  { id: 'neon', name: 'Neon', description: 'Electric cyan and magenta.' },
  { id: 'noir', name: 'Noir', description: 'Minimal monochrome.' },
  { id: 'chrome', name: 'Chrome', description: 'Cool metallic surfaces.' },
  { id: 'horizon', name: 'Horizon', description: 'Warm cinematic glow.' },
  { id: 'velvet', name: 'Velvet', description: 'Deep red and elegant type.' },
  { id: 'prism', name: 'Prism', description: 'Iridescent color and light.' },
];

/** Selector animation adapted from Skiper UI Skiper4. https://skiper-ui.com */
export function ProfileStyleSelector({ value, onApply, artistName, image }: {
  value: ProfileVisualStyle; onApply: (value: ProfileVisualStyle) => void;
  artistName: string; image?: string | null;
}) {
  const [draft, setDraft] = useState(value);
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const reducedMotion = useReducedMotion();
  useEffect(() => setDraft(value), [value]);
  const isEditorial = ['editorial', 'noir', 'velvet'].includes(draft);
  return <section className="mb-4 min-w-0 rounded-2xl border border-white/10 bg-zinc-950/70 p-3 sm:p-5" aria-labelledby="profile-style-heading">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div><h3 id="profile-style-heading" className="text-base font-semibold text-white">Profile style</h3><p className="mt-1 text-xs leading-relaxed text-zinc-400">Choose a look. Your content and module settings stay the same.</p></div>
      <div className="flex rounded-lg border border-white/10 bg-black/30 p-1" aria-label="Preview size">
        {(['desktop', 'mobile'] as const).map(size => <button key={size} type="button" aria-pressed={viewport === size} onClick={() => setViewport(size)} className={`min-h-9 rounded-md px-3 text-xs capitalize transition ${viewport === size ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-white'}`}>{size}</button>)}
      </div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Choose a profile style">
      {options.map(option => <button key={option.id} type="button" aria-pressed={draft === option.id} onClick={() => setDraft(option.id)} className={`relative min-w-0 rounded-xl border p-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${draft === option.id ? 'border-orange-400 bg-orange-500/10' : 'border-white/10 bg-white/[0.03] hover:border-white/30'}`}>
        {draft === option.id && <motion.span layoutId="profile-style-selection" transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }} className="absolute right-3 top-3 h-2 w-2 rounded-full bg-orange-400" />}
        <span className={`profile-style-swatch profile-style-swatch-${option.id} mb-2 block h-8 rounded-md`} aria-hidden="true" /><span className="block break-words text-sm font-semibold text-white">{option.name}</span><span className="mt-1 block break-words text-xs text-zinc-400">{option.description}</span>
      </button>)}
    </div>
    <div className="mt-4 rounded-xl border border-white/10 bg-[#09090c] p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-zinc-400"><span>Style preview · {viewport}</span><span>Illustrative layout</span></div>
      <div className={`profile-visual-${draft} mx-auto overflow-hidden rounded-lg border border-white/10 bg-[#101014] transition-[max-width] ${viewport === 'mobile' ? 'max-w-[220px]' : 'max-w-full'}`}>
        <div className={`relative overflow-hidden ${viewport === 'mobile' ? 'h-28' : 'h-36'}`}>
          {image ? <img src={image} alt="" className={`h-full w-full object-cover ${isEditorial ? 'grayscale' : ''}`} /> : <div className="h-full w-full bg-gradient-to-br from-zinc-700 to-zinc-950" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
          {draft !== 'classic' && image && viewport === 'desktop' && <div aria-hidden="true" className={`absolute bottom-3 right-5 top-3 w-[30%] overflow-hidden border border-white/40 shadow-2xl ${isEditorial ? 'rotate-3 rounded-sm' : '-rotate-3 rounded-xl'}`} style={{ transform: 'perspective(500px) rotateY(-12deg) rotateZ(-3deg)' }}><img src={image} alt="" className={`h-full w-full object-cover ${isEditorial ? 'grayscale' : ''}`} /></div>}
          <div className={`absolute bottom-3 left-3 ${draft !== 'classic' && viewport === 'desktop' ? 'right-[38%]' : 'right-3'}`}><p className={`${isEditorial ? 'font-serif text-2xl' : 'text-lg font-bold'} truncate text-white`}>{artistName || 'Artist'}</p><p className="mt-1 text-[10px] text-zinc-300">Music · Videos · About</p></div>
        </div>
        <div className={`space-y-2 ${isEditorial ? 'p-4' : 'p-3'}`} style={{ backgroundColor: draft === 'classic' ? '#101014' : 'var(--pv-card)' }} aria-hidden="true"><div className="h-1.5 w-1/4 rounded-full bg-white/40" /><div className="h-1.5 w-3/4 rounded-full bg-white/10" /><div className="h-1.5 w-1/2 rounded-full bg-white/10" /></div>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><a href="https://skiper-ui.com" target="_blank" rel="noopener noreferrer" className="min-w-0 break-words text-[11px] text-zinc-400 underline underline-offset-4 hover:text-white">Interface animation adapted from Skiper UI</a><button type="button" disabled={draft === value} onClick={() => onApply(draft)} className="min-h-10 rounded-lg bg-orange-500 px-4 text-xs font-semibold text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40">{draft === value ? 'Current style' : 'Apply style'}</button></div>
  </section>;
}
