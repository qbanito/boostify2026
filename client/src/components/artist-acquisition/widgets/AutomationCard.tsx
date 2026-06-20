import { useEffect, useState } from 'react';
import { Zap, Plus, Trash2, Play, AlertCircle, Check, Loader2 } from 'lucide-react';
import { SectionCard } from '../shared/SectionCard';
import { Modal } from '../shared/Modal';
import { TOKENS } from '../shared/tokens';
import { apiRequest } from '../../../lib/queryClient';

interface Workflow {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  action: string;
  triggerConfig?: Record<string, any>;
  actionConfig?: Record<string, any>;
  runCount?: number;
  errorCount?: number;
  lastRunAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  new_high_score_artist: 'New high-score artist',
  email_opened: 'Email opened',
  email_clicked: 'Email clicked',
  email_replied: 'Email replied',
  onboarding_completed: 'Onboarding completed',
  status_changed_to_responded: 'Status → responded',
  status_changed_to_won: 'Status → won',
};

const ACTION_LABELS: Record<string, string> = {
  send_sequence: 'Send sequence',
  create_landing: 'Create landing page',
  notify_team: 'Notify team',
  add_tag: 'Add tag',
  move_pipeline_stage: 'Move pipeline stage',
  enrich_images: 'Enrich images',
};

export function AutomationCard() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [availableTriggers, setAvailableTriggers] = useState<string[]>([]);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await apiRequest('GET', '/api/admin/artist-acquisition/automations');
      setWorkflows(res?.workflows || []);
      setAvailableTriggers(res?.availableTriggers || Object.keys(TRIGGER_LABELS));
      setAvailableActions(res?.availableActions || Object.keys(ACTION_LABELS));
    } catch {
      setAvailableTriggers(Object.keys(TRIGGER_LABELS));
      setAvailableActions(Object.keys(ACTION_LABELS));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res: any = await apiRequest('POST', '/api/admin/artist-acquisition/automations', {
        workflows,
      });
      setWorkflows(res?.workflows || workflows);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  const addWorkflow = () => {
    const wf: Workflow = {
      id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: 'New workflow',
      enabled: false,
      trigger: availableTriggers[0] || 'new_high_score_artist',
      action: availableActions[0] || 'send_sequence',
    };
    setWorkflows((prev) => [...prev, wf]);
  };

  const update = (id: string, patch: Partial<Workflow>) => {
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  };

  const remove = (id: string) => {
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
  };

  const enabledCount = workflows.filter((w) => w.enabled).length;
  const totalRuns = workflows.reduce((t, w) => t + (w.runCount || 0), 0);

  return (
    <>
      <SectionCard
        title="Automation"
        action={
          <span
            className="text-[11px] px-2 py-0.5 rounded-full"
            style={{
              color: enabledCount > 0 ? TOKENS.ORANGE_GLOW : TOKENS.MUTED,
              background: enabledCount > 0 ? TOKENS.ORANGE_SOFT : TOKENS.SURFACE_3,
              border: `1px solid ${enabledCount > 0 ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
            }}
          >
            {enabledCount} enabled · {totalRuns} runs
          </span>
        }
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}
          >
            <Zap size={16} style={{ color: TOKENS.ORANGE_GLOW }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold" style={{ color: TOKENS.TEXT }}>
              End-to-end discovery → activation workflows
            </div>
            <div className="text-[11.5px] mt-1" style={{ color: TOKENS.MUTED }}>
              Chain triggers (new high-score artist, opened email, onboarding done) to actions (send sequence, create landing, notify team, enrich images).
            </div>

            {loading ? (
              <div className="mt-3 flex items-center gap-2 text-[11.5px]" style={{ color: TOKENS.MUTED }}>
                <Loader2 size={12} className="animate-spin" /> Loading workflows…
              </div>
            ) : workflows.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                {workflows.slice(0, 3).map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-2 text-[11.5px] px-2 py-1.5 rounded-md"
                    style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: w.enabled ? TOKENS.POSITIVE : TOKENS.MUTED_2 }}
                    />
                    <span className="truncate flex-1" style={{ color: TOKENS.TEXT }}>{w.name}</span>
                    <span className="shrink-0" style={{ color: TOKENS.MUTED }}>
                      {TRIGGER_LABELS[w.trigger] || w.trigger}
                    </span>
                  </div>
                ))}
                {workflows.length > 3 && (
                  <div className="text-[11px]" style={{ color: TOKENS.MUTED }}>
                    +{workflows.length - 3} more
                  </div>
                )}
              </div>
            ) : null}

            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1 mt-3 text-[11.5px] px-2.5 py-1 rounded-full"
              style={{ color: TOKENS.ORANGE_GLOW, background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}
              data-testid="automation-configure"
            >
              Configure workflows
              <Play size={11} />
            </button>
          </div>
        </div>
      </SectionCard>

      <Modal open={open} onClose={() => setOpen(false)} title="Automation workflows" size="lg">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px]" style={{ color: TOKENS.MUTED }}>
                {workflows.length} workflow{workflows.length === 1 ? '' : 's'} · {enabledCount} enabled
              </span>
              <button
                onClick={addWorkflow}
                className="inline-flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-md"
                style={{ color: TOKENS.ORANGE_GLOW, background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}
                data-testid="automation-add"
              >
                <Plus size={11} /> Add workflow
              </button>
            </div>

            {workflows.length === 0 ? (
              <div
                className="text-[12px] text-center py-6 rounded-md"
                style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.MUTED }}
              >
                No workflows yet. Click "Add workflow" to create your first automation.
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scroll pr-1">
                {workflows.map((w) => (
                  <div
                    key={w.id}
                    className="rounded-md p-3"
                    style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={w.enabled}
                        onChange={(e) => update(w.id, { enabled: e.target.checked })}
                        className="shrink-0"
                        data-testid={`automation-toggle-${w.id}`}
                      />
                      <input
                        value={w.name}
                        onChange={(e) => update(w.id, { name: e.target.value })}
                        className="flex-1 bg-transparent text-[12.5px] font-semibold outline-none"
                        style={{ color: TOKENS.TEXT }}
                        placeholder="Workflow name"
                      />
                      {(w.runCount ?? 0) > 0 && (
                        <span className="text-[10.5px]" style={{ color: TOKENS.MUTED }}>
                          {w.runCount} runs{(w.errorCount ?? 0) > 0 && (
                            <span style={{ color: TOKENS.DANGER, marginLeft: 4 }}>
                              <AlertCircle size={9} style={{ display: 'inline', marginRight: 2 }} />
                              {w.errorCount} err
                            </span>
                          )}
                        </span>
                      )}
                      <button
                        onClick={() => remove(w.id)}
                        className="shrink-0 p-1 rounded hover:bg-white/5"
                        style={{ color: TOKENS.MUTED }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[10.5px]" style={{ color: TOKENS.MUTED_2 }}>WHEN</span>
                        <select
                          value={w.trigger}
                          onChange={(e) => update(w.id, { trigger: e.target.value })}
                          className="text-[11.5px] rounded px-2 py-1 outline-none"
                          style={{ background: TOKENS.SURFACE_2, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.TEXT }}
                        >
                          {availableTriggers.map((t) => (
                            <option key={t} value={t}>{TRIGGER_LABELS[t] || t}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10.5px]" style={{ color: TOKENS.MUTED_2 }}>THEN</span>
                        <select
                          value={w.action}
                          onChange={(e) => update(w.id, { action: e.target.value })}
                          className="text-[11.5px] rounded px-2 py-1 outline-none"
                          style={{ background: TOKENS.SURFACE_2, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.TEXT }}
                        >
                          {availableActions.map((a) => (
                            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: TOKENS.BORDER }}>
              {savedFlash && (
                <span className="text-[11.5px] flex items-center gap-1" style={{ color: TOKENS.POSITIVE }}>
                  <Check size={11} /> Saved
                </span>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-[11.5px] px-3 py-1.5 rounded-md"
                style={{ color: TOKENS.MUTED, border: `1px solid ${TOKENS.BORDER}` }}
              >
                Close
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="text-[11.5px] px-3 py-1.5 rounded-md font-semibold"
                style={{ color: '#111', background: TOKENS.ORANGE_GLOW, opacity: saving ? 0.6 : 1 }}
                data-testid="automation-save"
              >
                {saving ? 'Saving…' : 'Save workflows'}
              </button>
            </div>
          </div>
        </Modal>
    </>
  );
}
