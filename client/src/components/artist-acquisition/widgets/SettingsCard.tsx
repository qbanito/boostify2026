import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Check, Loader2, X } from 'lucide-react';
import { SectionCard } from '../shared/SectionCard';
import { Modal } from '../shared/Modal';
import { TOKENS } from '../shared/tokens';
import { apiRequest } from '../../../lib/queryClient';

interface WorkspaceSettings {
  adminEmails: string[];
  discoveryCadenceHours: number;
  defaultChannels: string[];
  auditRetentionDays: number;
  notifications: {
    email: boolean;
    inApp: boolean;
    slackWebhook: string | null;
  };
  updatedAt?: string;
  updatedBy?: string | null;
}

const DEFAULT: WorkspaceSettings = {
  adminEmails: [],
  discoveryCadenceHours: 24,
  defaultChannels: ['email'],
  auditRetentionDays: 90,
  notifications: { email: true, inApp: true, slackWebhook: null },
};

const CHANNEL_OPTIONS = ['email', 'instagram', 'tiktok', 'whatsapp', 'followup'];

export function SettingsCard() {
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT);
  const [envAdminEmails, setEnvAdminEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await apiRequest('GET', '/api/admin/artist-acquisition/settings');
      if (res?.settings) {
        setSettings({ ...DEFAULT, ...res.settings, notifications: { ...DEFAULT.notifications, ...(res.settings.notifications || {}) } });
      }
      if (Array.isArray(res?.envAdminEmails)) setEnvAdminEmails(res.envAdminEmails);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res: any = await apiRequest('POST', '/api/admin/artist-acquisition/settings', settings);
      if (res?.settings) setSettings({ ...DEFAULT, ...res.settings, notifications: { ...DEFAULT.notifications, ...(res.settings.notifications || {}) } });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  const addEmail = () => {
    const e = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    if (settings.adminEmails.includes(e)) return;
    setSettings((s) => ({ ...s, adminEmails: [...s.adminEmails, e] }));
    setNewEmail('');
  };

  const removeEmail = (e: string) => {
    setSettings((s) => ({ ...s, adminEmails: s.adminEmails.filter((x) => x !== e) }));
  };

  const toggleChannel = (ch: string) => {
    setSettings((s) => ({
      ...s,
      defaultChannels: s.defaultChannels.includes(ch)
        ? s.defaultChannels.filter((x) => x !== ch)
        : [...s.defaultChannels, ch],
    }));
  };

  return (
    <>
      <SectionCard
        title="Settings"
        action={
          <span
            className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
            style={{ color: TOKENS.MUTED, background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}
          >
            {loading && <Loader2 size={10} className="animate-spin" />}
            {settings.adminEmails.length || envAdminEmails.length} admin{((settings.adminEmails.length || envAdminEmails.length) === 1) ? '' : 's'}
          </span>
        }
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}
          >
            <SettingsIcon size={16} style={{ color: TOKENS.ORANGE_GLOW }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold" style={{ color: TOKENS.TEXT }}>
              Workspace &amp; access controls
            </div>
            <div className="text-[11.5px] mt-1" style={{ color: TOKENS.MUTED }}>
              Admin emails, discovery cadence ({settings.discoveryCadenceHours}h), default channels ({settings.defaultChannels.join(', ') || '—'}), audit retention ({settings.auditRetentionDays}d).
            </div>
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1 mt-3 text-[11.5px] px-2.5 py-1 rounded-full"
              style={{ color: TOKENS.ORANGE_GLOW, background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}
              data-testid="settings-open"
            >
              Open preferences
            </button>
          </div>
        </div>
      </SectionCard>

      <Modal open={open} onClose={() => setOpen(false)} title="Workspace preferences" size="md">
          <div className="space-y-4">
            {/* Admin emails */}
            <section>
              <div className="text-[11px] font-semibold tracking-widest uppercase mb-2" style={{ color: TOKENS.MUTED_2 }}>
                Admin emails
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {settings.adminEmails.length === 0 && envAdminEmails.map((e) => (
                  <span
                    key={e}
                    className="text-[11px] px-2 py-1 rounded-full"
                    style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.MUTED }}
                    title="From ADMIN_EMAILS env"
                  >
                    {e} <span style={{ opacity: 0.5 }}>(env)</span>
                  </span>
                ))}
                {settings.adminEmails.map((e) => (
                  <span
                    key={e}
                    className="text-[11px] px-2 py-1 rounded-full flex items-center gap-1"
                    style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}`, color: TOKENS.ORANGE_GLOW }}
                  >
                    {e}
                    <button onClick={() => removeEmail(e)} style={{ color: TOKENS.ORANGE_GLOW }}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                  placeholder="admin@example.com"
                  className="flex-1 text-[12px] px-2 py-1.5 rounded outline-none"
                  style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.TEXT }}
                  data-testid="settings-new-email"
                />
                <button
                  onClick={addEmail}
                  className="text-[11.5px] px-3 py-1.5 rounded"
                  style={{ color: TOKENS.TEXT, background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}
                >
                  Add
                </button>
              </div>
            </section>

            {/* Discovery cadence */}
            <section>
              <div className="text-[11px] font-semibold tracking-widest uppercase mb-2" style={{ color: TOKENS.MUTED_2 }}>
                Discovery cadence (hours)
              </div>
              <input
                type="number"
                min={1}
                max={168}
                value={settings.discoveryCadenceHours}
                onChange={(e) => setSettings((s) => ({ ...s, discoveryCadenceHours: Number(e.target.value) || 24 }))}
                className="w-24 text-[12px] px-2 py-1.5 rounded outline-none"
                style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.TEXT }}
              />
            </section>

            {/* Default channels */}
            <section>
              <div className="text-[11px] font-semibold tracking-widest uppercase mb-2" style={{ color: TOKENS.MUTED_2 }}>
                Default outreach channels
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CHANNEL_OPTIONS.map((ch) => {
                  const on = settings.defaultChannels.includes(ch);
                  return (
                    <button
                      key={ch}
                      onClick={() => toggleChannel(ch)}
                      className="text-[11px] px-2 py-1 rounded-full"
                      style={{
                        color: on ? TOKENS.ORANGE_GLOW : TOKENS.MUTED,
                        background: on ? TOKENS.ORANGE_SOFT : TOKENS.SURFACE_3,
                        border: `1px solid ${on ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
                      }}
                    >
                      {ch}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Audit retention */}
            <section>
              <div className="text-[11px] font-semibold tracking-widest uppercase mb-2" style={{ color: TOKENS.MUTED_2 }}>
                Audit log retention (days)
              </div>
              <input
                type="number"
                min={7}
                max={365}
                value={settings.auditRetentionDays}
                onChange={(e) => setSettings((s) => ({ ...s, auditRetentionDays: Number(e.target.value) || 90 }))}
                className="w-24 text-[12px] px-2 py-1.5 rounded outline-none"
                style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.TEXT }}
              />
            </section>

            {/* Notifications */}
            <section>
              <div className="text-[11px] font-semibold tracking-widest uppercase mb-2" style={{ color: TOKENS.MUTED_2 }}>
                Notifications
              </div>
              <label className="flex items-center gap-2 text-[12px] mb-1.5" style={{ color: TOKENS.TEXT }}>
                <input
                  type="checkbox"
                  checked={!!settings.notifications.email}
                  onChange={(e) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, email: e.target.checked } }))}
                />
                Email alerts
              </label>
              <label className="flex items-center gap-2 text-[12px] mb-2" style={{ color: TOKENS.TEXT }}>
                <input
                  type="checkbox"
                  checked={!!settings.notifications.inApp}
                  onChange={(e) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, inApp: e.target.checked } }))}
                />
                In-app notifications
              </label>
              <input
                type="url"
                value={settings.notifications.slackWebhook || ''}
                onChange={(e) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, slackWebhook: e.target.value || null } }))}
                placeholder="https://hooks.slack.com/..."
                className="w-full text-[12px] px-2 py-1.5 rounded outline-none"
                style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.TEXT }}
              />
            </section>

            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: TOKENS.BORDER }}>
              <span className="text-[10.5px]" style={{ color: TOKENS.MUTED_2 }}>
                {settings.updatedAt ? `Last updated ${new Date(settings.updatedAt).toLocaleString()}${settings.updatedBy ? ` by ${settings.updatedBy}` : ''}` : 'Not saved yet'}
              </span>
              <div className="flex items-center gap-2">
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
                  data-testid="settings-save"
                >
                  {saving ? 'Saving…' : 'Save preferences'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
    </>
  );
}
