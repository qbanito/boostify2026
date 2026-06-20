/**
 * OriginalSongForm
 *
 * Unified form for:
 *  Tab A — "Nueva canción original"      → /api/music-original/create
 *  Tab B — "Certificar canción existente" → /api/music-original/certify-existing
 *
 * The artist fills a minimal form + signs the authorship declaration.
 * No model names are shown — only "Boostify Music Generator".
 *
 * On success: calls onComplete(projectId) so the parent can show the certificate card.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Music, Mic, FileText, CheckCircle, Loader2,
  Sparkles, Shield, ChevronRight, AlertCircle, User
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArtistSong {
  id: number;
  title: string;
  genre: string | null;
  mood: string | null;
  audioUrl: string;
  coverArt: string | null;
  lyrics: string | null;
  createdAt: string;
}

interface OriginalSongFormProps {
  onComplete: (projectId: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GENRES = ['Pop', 'Latin', 'R&B / Soul', 'Hip-Hop / Trap', 'Reggaeton', 'Electronic', 'Rock', 'Balada', 'Jazz', 'Cumbia', 'Salsa', 'Country', 'Indie', 'Otro'];
const MOODS = ['Energético', 'Melancólico', 'Romántico', 'Motivacional', 'Festivo', 'Relajante', 'Nostálgico', 'Oscuro', 'Alegre', 'Misterioso'];
const LANGUAGES = [{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }, { value: 'pt', label: 'Português' }, { value: 'fr', label: 'Français' }];

// ─── Step indicator ───────────────────────────────────────────────────────────

function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
        done ? 'bg-green-500 text-black' : active ? 'bg-orange-500 text-black' : 'bg-white/10 text-white/40'
      }`}>
        {done ? '✓' : n}
      </div>
      <span className={`text-sm font-medium transition-colors ${active ? 'text-white' : done ? 'text-green-400' : 'text-white/30'}`}>
        {label}
      </span>
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function OriginalSongForm({ onComplete }: OriginalSongFormProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [step, setStep] = useState<1 | 2>(1);

  // New song fields
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [mood, setMood] = useState('Energético');
  const [language, setLanguage] = useState('es');
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [customLyrics, setCustomLyrics] = useState('');

  // Existing song fields
  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [selectedSong, setSelectedSong] = useState<ArtistSong | null>(null);

  // Authorship declaration (both modes)
  const [creativeStory, setCreativeStory] = useState('');
  const [originalVerse, setOriginalVerse] = useState('');
  const [declarationSigned, setDeclarationSigned] = useState(false);

  // Fetch artist's uploaded songs (for existing mode)
  const { data: songsData } = useQuery<{ songs: ArtistSong[] }>({
    queryKey: ['/api/music-original/songs'],
    queryFn: () => apiRequest('GET', '/api/music-original/songs').then(r => r.json()),
    enabled: mode === 'existing',
  });

  // Create new song mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/music-original/create', {
        title, genre, mood, language, isInstrumental,
        customLyrics: isInstrumental ? undefined : customLyrics || undefined,
        creativeStory: creativeStory || undefined,
        originalVerse: originalVerse || undefined,
        declarationSigned,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error'); }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: '¡En proceso!', description: 'Tu canción está siendo creada. El certificado llegará a tu correo en minutos.' });
      onComplete(data.projectId);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Certify existing song mutation
  const certifyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/music-original/certify-existing', {
        existingSongId: Number(selectedSongId),
        creativeStory: creativeStory || undefined,
        originalVerse: originalVerse || undefined,
        declarationSigned,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error'); }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: '¡Certificando!', description: 'El certificado de tu canción llegará a tu correo en minutos.' });
      onComplete(data.projectId);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const isLoading = createMutation.isPending || certifyMutation.isPending;

  function handleSongSelect(id: string) {
    setSelectedSongId(id);
    const song = songsData?.songs.find(s => String(s.id) === id);
    setSelectedSong(song || null);
  }

  function canProceedStep1(): boolean {
    if (mode === 'new') return title.trim().length > 0;
    return selectedSongId !== '';
  }

  function canSubmit(): boolean {
    if (!declarationSigned) return false;
    if (!creativeStory.trim() && !originalVerse.trim()) return false;
    return true;
  }

  function handleSubmit() {
    if (!canSubmit()) return;
    if (mode === 'new') createMutation.mutate();
    else certifyMutation.mutate();
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">

      {/* Mode selector */}
      <div className="flex rounded-xl overflow-hidden border border-white/10 mb-8">
        {[
          { key: 'new', icon: Sparkles, label: 'Crear canción original', sub: 'Generar con Boostify Music Generator' },
          { key: 'existing', icon: Music, label: 'Certificar canción existente', sub: 'Una canción que ya subiste a tu perfil' },
        ].map(({ key, icon: Icon, label, sub }) => (
          <button
            key={key}
            onClick={() => { setMode(key as any); setStep(1); }}
            className={`flex-1 flex items-center gap-3 p-4 transition-all ${
              mode === key
                ? 'bg-orange-500/20 border-b-2 border-orange-500'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 ${mode === key ? 'text-orange-400' : 'text-white/40'}`} />
            <div className="text-left">
              <p className={`text-sm font-semibold ${mode === key ? 'text-white' : 'text-white/50'}`}>{label}</p>
              <p className="text-xs text-white/30">{sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-4 mb-8">
        <Step n={1} label={mode === 'new' ? 'Detalles de la canción' : 'Seleccionar canción'} active={step === 1} done={step > 1} />
        <ChevronRight className="w-4 h-4 text-white/20" />
        <Step n={2} label="Declaración de autoría" active={step === 2} done={false} />
      </div>

      <AnimatePresence mode="wait">

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-5"
          >
            {mode === 'new' ? (
              <>
                <div>
                  <Label className="text-white/80 mb-2 block">Título de la canción *</Label>
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ej: Amor en el Caribe"
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus:border-orange-500/60"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white/80 mb-2 block">Género</Label>
                    <Select value={genre} onValueChange={setGenre}>
                      <SelectTrigger className="bg-white/5 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-white/20">
                        {GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-white/80 mb-2 block">Estado de ánimo</Label>
                    <Select value={mood} onValueChange={setMood}>
                      <SelectTrigger className="bg-white/5 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-white/20">
                        {MOODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white/80 mb-2 block">Idioma</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="bg-white/5 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-white/20">
                        {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col justify-end pb-1">
                    <Label className="text-white/80 mb-2 block">Instrumental</Label>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={isInstrumental}
                        onCheckedChange={setIsInstrumental}
                        className="data-[state=checked]:bg-orange-500"
                      />
                      <span className="text-sm text-white/50">{isInstrumental ? 'Sí, sin letra' : 'Con letra'}</span>
                    </div>
                  </div>
                </div>

                {!isInstrumental && (
                  <div>
                    <Label className="text-white/80 mb-2 block">Letra personalizada <span className="text-white/30 font-normal">(opcional — si ya la escribiste)</span></Label>
                    <Textarea
                      value={customLyrics}
                      onChange={e => setCustomLyrics(e.target.value)}
                      placeholder="[Verso 1]&#10;...&#10;[Coro]&#10;..."
                      rows={5}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/20 focus:border-orange-500/60 resize-none"
                    />
                  </div>
                )}
              </>
            ) : (
              /* Existing song selector */
              <>
                {!songsData?.songs?.length ? (
                  <div className="text-center py-12 text-white/40">
                    <Music className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No tienes canciones en tu perfil todavía.</p>
                    <p className="text-sm mt-1">Sube canciones en tu Artist Profile para certificarlas aquí.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label className="text-white/80 mb-2 block">Selecciona una canción de tu perfil *</Label>
                    <div className="grid gap-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                      {songsData.songs.map(song => (
                        <button
                          key={song.id}
                          onClick={() => handleSongSelect(String(song.id))}
                          className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                            selectedSongId === String(song.id)
                              ? 'border-orange-500 bg-orange-500/10'
                              : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          {song.coverArt ? (
                            <img src={song.coverArt} alt={song.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                              <Music className="w-5 h-5 text-orange-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">{song.title}</p>
                            <p className="text-sm text-white/40">{song.genre} {song.mood && `· ${song.mood}`}</p>
                          </div>
                          {selectedSongId === String(song.id) && (
                            <CheckCircle className="w-5 h-5 text-orange-400 ml-auto flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <Button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1()}
              className="w-full bg-orange-500 hover:bg-orange-600 text-black font-bold h-12 mt-2"
            >
              Continuar — Declaración de autoría
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* ── STEP 2 — Authorship declaration ── */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            {/* Song summary */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <Music className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="font-bold text-white">{mode === 'new' ? title : selectedSong?.title}</p>
                <p className="text-sm text-white/40">
                  {mode === 'new'
                    ? `${genre} · ${mood} · ${LANGUAGES.find(l => l.value === language)?.label}`
                    : `${selectedSong?.genre || '—'}`}
                </p>
              </div>
              <button onClick={() => setStep(1)} className="ml-auto text-white/30 hover:text-white/60 text-sm">Cambiar</button>
            </div>

            {/* Story field */}
            <div>
              <Label className="text-white/80 mb-2 block flex items-center gap-2">
                <Mic className="w-4 h-4 text-orange-400" />
                ¿Qué quieres comunicar con esta canción?
              </Label>
              <Textarea
                value={creativeStory}
                onChange={e => setCreativeStory(e.target.value)}
                placeholder="Ej: Esta canción habla de cuando me fui de mi ciudad a los 17 años buscando mis sueños. El miedo, la ilusión y el amor que dejé atrás..."
                rows={4}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/20 focus:border-orange-500/60 resize-none"
              />
              <p className="text-xs text-white/30 mt-1">Tu historia personal — parte de la evidencia de autoría.</p>
            </div>

            {/* Original verse */}
            <div>
              <Label className="text-white/80 mb-2 block flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                Tu verso o frase original *
              </Label>
              <Textarea
                value={originalVerse}
                onChange={e => setOriginalVerse(e.target.value)}
                placeholder="Al menos una línea, frase o verso escrito por ti — puede ser un borrador imperfecto."
                rows={3}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/20 focus:border-purple-500/60 resize-none"
              />
              <p className="text-xs text-white/30 mt-1">Esto es lo que prueba tu participación creativa directa.</p>
            </div>

            {/* Declaration checkbox */}
            <div className={`rounded-xl border p-5 transition-all ${
              declarationSigned ? 'border-green-500/40 bg-green-500/5' : 'border-white/10 bg-white/5'
            }`}>
              <div className="flex items-start gap-4">
                <button
                  onClick={() => setDeclarationSigned(!declarationSigned)}
                  className={`w-6 h-6 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all mt-0.5 ${
                    declarationSigned ? 'bg-green-500 border-green-500' : 'border-white/30 hover:border-white/60'
                  }`}
                >
                  {declarationSigned && <CheckCircle className="w-4 h-4 text-black" />}
                </button>
                <div>
                  <p className="text-white font-medium text-sm leading-relaxed">
                    Yo, [tu nombre], declaro que inicié, dirigí y supervisé la creación artística de esta obra.
                    La historia y el verso que proporcioné son de mi autoría. Entiendo que esta declaración,
                    junto con la huella digital SHA-256 de la obra, constituirán evidencia de mi participación
                    creativa.
                  </p>
                  <p className="text-white/40 text-xs mt-2">
                    Fecha: {new Date().toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            </div>

            {!canSubmit() && (
              <div className="flex items-center gap-2 text-amber-400/80 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {!declarationSigned
                  ? 'Debes firmar la declaración de autoría para continuar.'
                  : 'Agrega tu historia o verso original para continuar.'}
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="border-white/20 text-white/60 hover:text-white hover:bg-white/10 flex-shrink-0"
              >
                Atrás
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit() || isLoading}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-black font-bold h-12"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {mode === 'new' ? 'Creando tu canción...' : 'Certificando...'}
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    {mode === 'new' ? 'Crear y certificar mi canción' : 'Certificar esta canción'}
                  </>
                )}
              </Button>
            </div>

            {/* Info note */}
            <p className="text-center text-xs text-white/30 leading-relaxed">
              Recibirás el certificado completo por email. El proceso puede tardar 2-5 minutos.
              {mode === 'new' && ' La canción se generará con Boostify Music Generator.'}
            </p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
