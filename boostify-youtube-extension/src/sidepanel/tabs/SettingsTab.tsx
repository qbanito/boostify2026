import React, { useState } from 'react';
import { useSidePanelStore } from '../store';
import { saveSettings } from '../../shared/storage';
import { DEFAULT_SETTINGS, type ExtSettings } from '../../shared/types';

export function SettingsTab() {
  const { settings, init } = useSidePanelStore();
  const [local, setLocal] = useState<ExtSettings>(settings || DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  const update = (key: keyof ExtSettings, value: any) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    await saveSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Sync Settings */}
      <SettingsSection title="🔄 Sync">
        <ToggleRow
          label="Auto-sync on YouTube visits"
          checked={local.autoSyncEnabled}
          onChange={(v) => update('autoSyncEnabled', v)}
        />
        <SelectRow
          label="Sync interval"
          value={String(local.syncIntervalMinutes)}
          options={[
            { label: '1 min', value: '1' },
            { label: '5 min', value: '5' },
            { label: '15 min', value: '15' },
            { label: '30 min', value: '30' },
            { label: '1 hour', value: '60' },
          ]}
          onChange={(v) => update('syncIntervalMinutes', Number(v))}
        />
      </SettingsSection>

      {/* UI Settings */}
      <SettingsSection title="🎨 Appearance">
        <ToggleRow
          label="Show Boostify badges on thumbnails"
          checked={local.showBadges}
          onChange={(v) => update('showBadges', v)}
        />
        <ToggleRow
          label="Show SEO hints on video pages"
          checked={local.showSeoHints}
          onChange={(v) => update('showSeoHints', v)}
        />
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection title="🔔 Notifications">
        <ToggleRow
          label="Enable desktop notifications"
          checked={local.notificationsEnabled}
          onChange={(v) => update('notificationsEnabled', v)}
        />
        <ToggleRow
          label="Notify on new pending actions"
          checked={local.notifyOnNewActions}
          onChange={(v) => update('notifyOnNewActions', v)}
        />
        <ToggleRow
          label="Notify on milestones"
          checked={local.notifyOnMilestones}
          onChange={(v) => update('notifyOnMilestones', v)}
        />
      </SettingsSection>

      {/* Save */}
      <button
        onClick={handleSave}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
          saved
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700'
        }`}
      >
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#141414] rounded-xl border border-[#2a2a2a] overflow-hidden">
      <h3 className="text-xs font-semibold text-[#888] p-3 border-b border-[#2a2a2a]">{title}</h3>
      <div className="divide-y divide-[#1a1a1a]">{children}</div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-[#ccc]">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full transition-colors relative ${checked ? 'bg-orange-500' : 'bg-[#333]'}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function SelectRow({
  label, value, options, onChange,
}: {
  label: string; value: string; options: { label: string; value: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-[#ccc]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#1a1a1a] border border-[#333] text-xs text-white rounded px-2 py-1 focus:outline-none focus:border-orange-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
