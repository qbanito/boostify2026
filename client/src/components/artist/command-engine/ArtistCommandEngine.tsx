import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { Command, ChevronDown, RotateCcw, Eye, Pencil, Send, Megaphone } from 'lucide-react';
import { Button } from '../../ui/button';
import { useToast } from '../../../hooks/use-toast';
import { useArtistCommand } from '../../../hooks/use-artist-command';
import { CommandInput } from './CommandInput';
import { ArtistCommandAnimation } from './ArtistCommandAnimation';
import { CommandExecutionPanel } from './CommandExecutionPanel';

interface ArtistCommandEngineProps {
  artistId: string;
  artistName: string;
  artistImageUrl?: string | null;
  genre?: string;
}

/**
 * Artist Command Engine — owner-only control surface.
 * "Hey <artist>, crea una canción…" → intent parsing → module orchestration →
 * cinematic execution stage → per-module results saved to the artist profile.
 */
export function ArtistCommandEngine({ artistId, artistName, artistImageUrl, genre }: ArtistCommandEngineProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editText, setEditText] = useState('');
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const engine = useArtistCommand({ artistId, artistName, artistImageUrl, genre });

  const showStage = !!engine.commandId;
  const isDone = engine.status === 'completed' || engine.status === 'failed';

  /** Pick the most "shippable" media asset produced by the run. */
  const primaryAsset = (): { url: string; kind: string } | null => {
    const order = ['video', 'audio', 'image'];
    for (const kind of order) {
      const t = engine.tasks.find((t) => t.output?.type === kind);
      const url = t?.output?.videoUrl || t?.output?.audioUrl || t?.output?.imageUrl;
      if (url) return { url, kind };
    }
    return null;
  };

  const handleView = () => {
    const asset = primaryAsset();
    if (asset) {
      window.open(asset.url, '_blank', 'noopener,noreferrer');
    } else {
      document.getElementById(`ace-results-${engine.commandId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast({ title: 'Creación lista', description: 'Tus módulos están más abajo. Toca cada uno para ver el resultado.' });
    }
  };

  const handleEdit = () => {
    const last = engine.lastCommandText || engine.command?.rawCommand || '';
    engine.reset();
    setEditText(last);
    setCollapsed(false);
    toast({ title: 'Editar comando', description: 'Ajusta tu orden y vuelve a ejecutarla.' });
  };

  const handlePublish = () => {
    const captionTask = engine.tasks.find((t) => t.moduleKey === 'caption');
    const caption = captionTask?.output?.content || '';
    if (caption) {
      navigator.clipboard?.writeText(caption).catch(() => {});
    }
    toast({
      title: 'Listo para publicar',
      description: caption ? 'Caption copiado. Te llevo al generador de redes.' : 'Te llevo al generador de redes.',
    });
    navigate('/social-media-generator');
  };

  const handleCampaign = () => {
    const topic = engine.command?.params?.topic || engine.lastCommandText || `${artistName} nuevo lanzamiento`;
    const cmd = `Hey ${artistName}, prepara una campaña de promoción multiplataforma para "${topic}".`;
    engine.reset();
    setEditText('');
    setTimeout(() => engine.submit({ command: cmd, source: 'text' }), 60);
    toast({ title: 'Creando campaña', description: 'Generando brief, caption y metadata de campaña.' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative my-4 overflow-hidden rounded-3xl border border-orange-500/25 bg-gradient-to-b from-[#160c04] to-black shadow-[0_0_40px_rgba(249,115,22,0.08)]"
    >
      {/* header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30">
          <Command className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h3 className="text-base font-bold text-white">Artist Command Engine</h3>
          <p className="text-xs text-white/50">Da una orden por voz o texto y deja que tus módulos creen por ti.</p>
        </div>
        <ChevronDown className={`h-5 w-5 text-white/40 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-4 px-5 pb-5"
          >
            <CommandInput
              artistName={artistName}
              disabled={engine.isActive}
              isSubmitting={engine.isSubmitting}
              initialText={editText}
              onSubmit={(command, source) => engine.submit({ command, source })}
            />

            {engine.submitError && (
              <p className="text-xs text-red-300">{engine.submitError}</p>
            )}

            <AnimatePresence>
              {showStage && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <ArtistCommandAnimation
                    artistName={artistName}
                    artistImageUrl={artistImageUrl}
                    tasks={engine.tasks}
                    progress={engine.progress}
                    status={engine.status}
                    currentModule={engine.command?.currentModule}
                  />

                  {engine.tasks.length > 0 && (
                    <div id={`ace-results-${engine.commandId}`}>
                      <CommandExecutionPanel tasks={engine.tasks} />
                    </div>
                  )}

                  {isDone && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" onClick={handleView} className="bg-orange-500 text-black hover:bg-orange-400">
                        <Eye className="mr-1.5 h-4 w-4" /> Ver creación
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleEdit} className="border-white/15 text-white/80 hover:bg-white/5">
                        <Pencil className="mr-1.5 h-4 w-4" /> Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={handlePublish} className="border-white/15 text-white/80 hover:bg-white/5">
                        <Send className="mr-1.5 h-4 w-4" /> Publicar
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCampaign} className="border-white/15 text-white/80 hover:bg-white/5">
                        <Megaphone className="mr-1.5 h-4 w-4" /> Crear campaña
                      </Button>
                      <Button size="sm" variant="ghost" onClick={engine.reset} className="text-white/50 hover:text-orange-300">
                        <RotateCcw className="mr-1.5 h-4 w-4" /> Nuevo comando
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default ArtistCommandEngine;
