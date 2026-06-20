import { useEffect, useState } from 'react';
import { Plus, ChevronRight, Play, Loader2 } from 'lucide-react';
import { SectionCard } from '../shared/SectionCard';
import { Modal } from '../shared/Modal';
import { TOKENS } from '../shared/tokens';
import { apiRequest } from '../../../lib/queryClient';
import { visualAssets } from '../../../data/mockArtistAcquisition';

type Asset = { title: string; subtitle: string; img: string };

export function VisualAssetsCard({ artistId }: { artistId?: string }) {
  const [active, setActive] = useState<string>(visualAssets.active);
  const [gallery, setGallery] = useState(false);
  const [preview, setPreview] = useState<Asset | null>(null);
  const [generating, setGenerating] = useState(false);
  const [remote, setRemote] = useState<Asset[] | null>(null);

  // Fetch real assets when we know the artist
  useEffect(() => {
    if (!artistId) return;
    apiRequest('GET', `/api/admin/artist-acquisition/visual-assets?artistId=${encodeURIComponent(artistId)}`)
      .then((res: any) => {
        const items = (res?.items || []) as any[];
        if (!items.length) return;
        setRemote(
          items.map((it) => ({
            title: it.label || 'Asset',
            subtitle: it.tab === 'teasers' ? 'Video Teaser' : 'Cover Art',
            img: it.url,
          }))
        );
      })
      .catch(() => {
        /* keep mock fallback */
      });
  }, [artistId]);

  const items: Asset[] =
    remote && remote.length
      ? remote
      : visualAssets.itemsByTab[active] || visualAssets.items;
  const isVideo = active === 'Video Teaser';

  const handleGenerate = () => {
    if (generating) return;
    setGenerating(true);
    // Simulate generation; real endpoint not yet available
    setTimeout(() => setGenerating(false), 1600);
  };

  return (
    <SectionCard
      number="04"
      title="Visual Asset Generation"
      action={
        <button
          onClick={() => setGallery(true)}
          className="flex items-center gap-1 text-[11.5px] transition-colors hover:text-white"
          style={{ color: TOKENS.MUTED }}
        >
          View All
          <ChevronRight size={11} />
        </button>
      }
    >
      <div className="flex gap-2 mb-4 overflow-x-auto custom-scroll -mx-1 px-1">
        {visualAssets.tabs.map((t) => {
          const isActive = t === active;
          return (
            <button
              key={t}
              onClick={() => setActive(t)}
              className="px-3 py-1.5 rounded-md text-[11.5px] font-medium transition-colors whitespace-nowrap shrink-0"
              style={
                isActive
                  ? {
                      background: TOKENS.ORANGE_SOFT,
                      color: TOKENS.ORANGE_GLOW,
                      border: `1px solid ${TOKENS.ORANGE_RING}`,
                    }
                  : {
                      background: 'transparent',
                      color: TOKENS.MUTED,
                      border: `1px solid ${TOKENS.BORDER}`,
                    }
              }
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {items.map((it, i) => (
          <button
            key={`${active}-${i}`}
            onClick={() => setPreview(it)}
            className="relative aspect-[3/4] rounded-lg overflow-hidden group cursor-pointer text-left"
            style={{ border: `1px solid ${TOKENS.BORDER}` }}
          >
            <img
              src={it.img}
              alt={it.title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.85) 100%)',
              }}
            />
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(0,0,0,0.6)',
                    border: `1px solid ${TOKENS.ORANGE_RING}`,
                  }}
                >
                  <Play
                    size={14}
                    style={{ color: TOKENS.ORANGE_GLOW }}
                    fill={TOKENS.ORANGE_GLOW}
                  />
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 right-2">
              <div
                className="text-[11px] font-bold leading-none"
                style={{ color: TOKENS.TEXT, letterSpacing: 0.4 }}
              >
                {it.title}
              </div>
              <div
                className="text-[9.5px] mt-0.5 font-semibold"
                style={{ color: TOKENS.ORANGE_GLOW, letterSpacing: 0.4 }}
              >
                {it.subtitle}
              </div>
            </div>
          </button>
        ))}

        {/* Generate more */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="aspect-[3/4] rounded-lg flex flex-col items-center justify-center gap-2 transition-colors hover:bg-white/5 disabled:opacity-70"
          style={{
            border: `1.5px dashed ${TOKENS.BORDER}`,
            color: TOKENS.MUTED,
          }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: TOKENS.ORANGE_SOFT,
              border: `1px solid ${TOKENS.ORANGE_RING}`,
            }}
          >
            {generating ? (
              <Loader2
                size={16}
                className="animate-spin"
                style={{ color: TOKENS.ORANGE_GLOW }}
              />
            ) : (
              <Plus size={16} style={{ color: TOKENS.ORANGE_GLOW }} />
            )}
          </div>
          <div
            className="text-[10.5px] font-medium text-center leading-tight"
            style={{ color: TOKENS.MUTED }}
          >
            {generating ? (
              <>Generating…</>
            ) : (
              <>
                Generate
                <br />
                More
              </>
            )}
          </div>
        </button>
      </div>

      {/* Gallery modal */}
      <Modal
        open={gallery}
        onClose={() => setGallery(false)}
        title={`All ${active} Assets`}
        subtitle="Click any asset to preview at full resolution."
        size="xl"
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {visualAssets.tabs.map((t) => {
            const isActive = t === active;
            return (
              <button
                key={t}
                onClick={() => setActive(t)}
                className="px-3 py-1.5 rounded-md text-[11.5px] font-medium"
                style={
                  isActive
                    ? {
                        background: TOKENS.ORANGE_SOFT,
                        color: TOKENS.ORANGE_GLOW,
                        border: `1px solid ${TOKENS.ORANGE_RING}`,
                      }
                    : {
                        background: 'transparent',
                        color: TOKENS.MUTED,
                        border: `1px solid ${TOKENS.BORDER}`,
                      }
                }
              >
                {t}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((it, i) => (
            <button
              key={`all-${active}-${i}`}
              onClick={() => {
                setPreview(it);
                setGallery(false);
              }}
              className="relative aspect-[3/4] rounded-lg overflow-hidden text-left group"
              style={{ border: `1px solid ${TOKENS.BORDER}` }}
            >
              <img
                src={it.img}
                alt={it.title}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.85) 100%)',
                }}
              />
              <div className="absolute bottom-2 left-2 right-2">
                <div
                  className="text-[11px] font-bold leading-none"
                  style={{ color: TOKENS.TEXT }}
                >
                  {it.title}
                </div>
                <div
                  className="text-[9.5px] mt-0.5 font-semibold"
                  style={{ color: TOKENS.ORANGE_GLOW }}
                >
                  {it.subtitle}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Preview modal */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.title}
        subtitle={preview?.subtitle}
        size="lg"
      >
        {preview && (
          <div
            className="rounded-xl overflow-hidden flex items-center justify-center"
            style={{
              background: TOKENS.SURFACE_3,
              border: `1px solid ${TOKENS.BORDER}`,
              maxHeight: '70vh',
            }}
          >
            <img
              src={preview.img}
              alt={preview.title}
              className="w-full h-auto object-contain"
              style={{ maxHeight: '70vh' }}
            />
          </div>
        )}
      </Modal>
    </SectionCard>
  );
}
