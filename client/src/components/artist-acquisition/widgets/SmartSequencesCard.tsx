import { useEffect, useState } from 'react';
import {
  Mail,
  Instagram,
  Music2,
  MessageCircle,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { SectionCard } from '../shared/SectionCard';
import { Modal } from '../shared/Modal';
import { Sparkline } from '../shared/Sparkline';
import { TOKENS } from '../shared/tokens';
import { apiRequest } from '../../../lib/queryClient';
import { sequence as mockSequence } from '../../../data/mockArtistAcquisition';
import type { AcquisitionSequences } from '../../../hooks/use-acquisition-overview';

const ICONS: Record<string, any> = {
  email: Mail,
  instagram: Instagram,
  tiktok: Music2,
  whatsapp: MessageCircle,
  followup: ArrowRight,
};

export function SmartSequencesCard({ data }: { data?: AcquisitionSequences }) {
  const sequence = data || mockSequence;
  const [editing, setEditing] = useState(false);
  const [steps, setSteps] = useState(sequence.steps);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);

  // Whenever the parent overview refetches, take the server's merged steps as truth
  // (the server already merges persisted sequence-config on top of defaults).
  useEffect(() => {
    setSteps(sequence.steps);
  }, [sequence]);

  const toggleStep = (id: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
  };

  const persistAndClose = async () => {
    setSaving(true);
    try {
      const channels = steps.reduce<Record<string, boolean>>((acc, s) => {
        acc[s.id] = !!s.active;
        return acc;
      }, {});
      await apiRequest('POST', '/api/admin/artist-acquisition/sequence-config', {
        channels,
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      console.warn('[SmartSequences] Persist failed:', err);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  return (
    <SectionCard
      number="05"
      title="Smart Sequences"
      action={
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 text-[11.5px] transition-colors hover:text-white"
          style={{ color: savedFlash ? TOKENS.ORANGE_GLOW : TOKENS.MUTED }}
        >
          {savedFlash ? 'Saved ✓' : 'Edit Sequence'}
          <ChevronRight size={11} />
        </button>
      }
    >
      <div className="flex items-start justify-between gap-1.5">
        {steps.map((step, i) => {
          const Icon = ICONS[step.id] || Mail;
          const isActive = step.active;
          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={
                    isActive
                      ? {
                          background:
                            'radial-gradient(circle, rgba(255,138,31,0.35) 0%, rgba(255,122,0,0.05) 70%)',
                          border: `1.5px solid ${TOKENS.ORANGE}`,
                          boxShadow: '0 0 18px rgba(255,138,31,0.45)',
                        }
                      : {
                          background: TOKENS.SURFACE_3,
                          border: `1px solid ${TOKENS.BORDER}`,
                        }
                  }
                >
                  <Icon
                    size={16}
                    style={{
                      color: isActive ? TOKENS.ORANGE_GLOW : TOKENS.MUTED,
                    }}
                  />
                </div>
                <div className="text-center">
                  <div
                    className="text-[11px] font-medium"
                    style={{
                      color: isActive ? TOKENS.TEXT : TOKENS.MUTED,
                    }}
                  >
                    {step.label}
                  </div>
                  <div
                    className="text-[9.5px]"
                    style={{ color: TOKENS.MUTED_2 }}
                  >
                    {step.day}
                  </div>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div
                  className="h-px flex-1 mt-[-22px]"
                  style={{
                    background: `linear-gradient(90deg, ${TOKENS.BORDER} 0%, transparent 100%)`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Performance */}
      <div
        className="mt-5 rounded-lg p-3.5"
        style={{
          background: TOKENS.SURFACE_3,
          border: `1px solid ${TOKENS.BORDER}`,
        }}
      >
        <div
          className="text-[11px] uppercase tracking-wider mb-2"
          style={{ color: TOKENS.MUTED }}
        >
          Sequence Performance
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
            <Stat label="Delivered" value={sequence.performance.delivered} />
            <Stat label="Open Rate" value={sequence.performance.openRate} />
            <Stat label="Reply Rate" value={sequence.performance.replyRate} />
            <Stat
              label="Positive Reply"
              value={sequence.performance.positiveReply}
            />
          </div>
          <div className="w-full sm:w-[90px] h-9">
            <Sparkline
              data={sequence.performance.spark}
              height={36}
              fill={false}
            />
          </div>
        </div>
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit Outreach Sequence"
        subtitle="Toggle channels on or off. Changes apply to new leads entering the sequence."
        size="md"
      >
        <div className="space-y-2">
          {steps.map((s) => {
            const Icon = ICONS[s.id] || Mail;
            const isActive = s.active;
            return (
              <button
                key={s.id}
                onClick={() => toggleStep(s.id)}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-white/5"
                style={{
                  background: TOKENS.SURFACE_3,
                  border: `1px solid ${isActive ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={
                    isActive
                      ? {
                          background: TOKENS.ORANGE_SOFT,
                          border: `1px solid ${TOKENS.ORANGE_RING}`,
                        }
                      : {
                          background: TOKENS.SURFACE_2,
                          border: `1px solid ${TOKENS.BORDER}`,
                        }
                  }
                >
                  <Icon
                    size={14}
                    style={{ color: isActive ? TOKENS.ORANGE_GLOW : TOKENS.MUTED }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[13px] font-semibold"
                    style={{ color: TOKENS.TEXT }}
                  >
                    {s.label}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: TOKENS.MUTED }}
                  >
                    {s.day}
                  </div>
                </div>
                <div
                  className="w-9 h-5 rounded-full relative transition-colors"
                  style={{
                    background: isActive ? TOKENS.ORANGE : TOKENS.SURFACE_2,
                    border: `1px solid ${isActive ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
                  }}
                >
                  <span
                    className="absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all"
                    style={{
                      left: isActive ? 18 : 2,
                      background: '#fff',
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setSteps(sequence.steps);
              setEditing(false);
            }}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors hover:bg-white/5"
            style={{
              color: TOKENS.MUTED,
              border: `1px solid ${TOKENS.BORDER}`,
            }}
          >
            Cancel
          </button>
          <button
            onClick={persistAndClose}
            disabled={saving}
            className="px-3 py-1.5 rounded-md text-[12px] font-semibold disabled:opacity-60"
            style={{ background: TOKENS.ORANGE, color: '#0a0a0a' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Modal>
    </SectionCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px]" style={{ color: TOKENS.MUTED }}>
        {label}
      </div>
      <div
        className="text-[14px] font-semibold mt-0.5"
        style={{ color: TOKENS.TEXT }}
      >
        {value}
      </div>
    </div>
  );
}
