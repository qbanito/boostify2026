/**
 * AmazonAffiliateSettings — owner-only panel embedded in the Amazon module.
 * Lets the artist register their personal Amazon Associates tag and toggle
 * the AI keyword booster.
 */

import { useEffect, useMemo, useState } from 'react';
import { Save, X, ExternalLink, CheckCircle2, Sparkles, Plus, Trash2, ListChecks } from 'lucide-react';
import {
  useAmazonSettings,
  useUpdateAmazonSettings,
  type ManualPick,
} from '../../hooks/use-amazon-picks';

interface Props {
  artistId: number;
  colors: { hexAccent: string; hexPrimary: string; hexBorder: string };
  onClose?: () => void;
}

const TAG_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,28}[a-zA-Z0-9])?-[0-9]{2}$/;
const ASIN_REGEX = /^[A-Z0-9]{10}$/i;
const MAX_MANUAL_PICKS = 25;

/** Extract a 10-char ASIN from a raw Amazon URL or plain ASIN string. */
function extractAsin(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (ASIN_REGEX.test(t)) return t.toUpperCase();
  // Match /dp/XXXXXXXXXX or /gp/product/XXXXXXXXXX
  const m = t.match(/(?:\/dp\/|\/gp\/product\/|\/-\/[a-z]{2}\/dp\/)([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}

export function AmazonAffiliateSettings({ artistId, colors, onClose }: Props) {
  const { data, isLoading } = useAmazonSettings(artistId);
  const update = useUpdateAmazonSettings(artistId);

  const [tag, setTag] = useState('');
  const [boosterOn, setBoosterOn] = useState(true);
  const [manualPicks, setManualPicks] = useState<ManualPick[]>([]);
  const [marketplaceOverride, setMarketplaceOverride] = useState<string>('');
  const [newAsinInput, setNewAsinInput] = useState('');
  const [newTitleInput, setNewTitleInput] = useState('');
  const [asinError, setAsinError] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (data) {
      setTag(data.amazonAffiliateTag || '');
      setBoosterOn(data.amazonAiBoosterEnabled);
      setManualPicks(Array.isArray(data.amazonManualPicks) ? data.amazonManualPicks : []);
      setMarketplaceOverride(data.amazonMarketplaceOverride || '');
    }
  }, [data]);

  const supportedMarketplaces = data?.supportedMarketplaces || [];
  const marketplaceLabel = useMemo(() => {
    if (data?.marketplace?.label) return data.marketplace.label;
    const m = tag.match(/-([0-9]{2})$/);
    if (m?.[1] === '21') return 'United Kingdom';
    if (m?.[1] === '20') return 'United States';
    return null;
  }, [data, tag]);

  const validateTag = (v: string): string | null => {
    const trimmed = v.trim();
    if (!trimmed) return null; // empty = use platform default
    if (!TAG_REGEX.test(trimmed)) {
      return 'Format must be like "myartist-20" (letters/numbers/dashes, ending with -NN)';
    }
    return null;
  };

  const handleAddPick = () => {
    setAsinError(null);
    const asin = extractAsin(newAsinInput);
    if (!asin) {
      setAsinError('Paste an ASIN (10 chars) or full Amazon product URL');
      return;
    }
    if (manualPicks.some((p) => p.asin.toUpperCase() === asin)) {
      setAsinError('Already in your list');
      return;
    }
    if (manualPicks.length >= MAX_MANUAL_PICKS) {
      setAsinError(`Maximum ${MAX_MANUAL_PICKS} picks reached`);
      return;
    }
    setManualPicks((prev) => [
      ...prev,
      { asin, title: newTitleInput.trim() || undefined },
    ]);
    setNewAsinInput('');
    setNewTitleInput('');
  };

  const handleRemovePick = (asin: string) => {
    setManualPicks((prev) => prev.filter((p) => p.asin !== asin));
  };

  const handleSave = () => {
    const err = validateTag(tag);
    if (err) {
      setTagError(err);
      return;
    }
    setTagError(null);
    update.mutate(
      {
        amazonAffiliateTag: (tag.trim() || null) as any,
        amazonAiBoosterEnabled: boosterOn,
        amazonManualPicks: manualPicks,
        amazonMarketplaceOverride: (marketplaceOverride || null) as any,
      } as any,
      {
        onSuccess: () => {
          setSavedAt(Date.now());
          setTimeout(() => setSavedAt(null), 3000);
        },
      },
    );
  };

  return (
    <div
      className="rounded-lg p-4 space-y-4 bg-zinc-950/80 border"
      style={{ borderColor: colors.hexBorder }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: colors.hexAccent }} />
          Amazon Affiliate Settings
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {!data?.paapiConfigured && manualPicks.length === 0 && (
        <div className="text-[12px] text-amber-300 bg-amber-950/30 border border-amber-900/50 rounded p-2">
          <strong>No PA-API access?</strong> No problem. Use the <em>Manual Picks</em> editor
          below to paste up to {MAX_MANUAL_PICKS} Amazon product links — they’ll show in your
          storefront with your affiliate tag automatically applied.
        </div>
      )}

      {marketplaceLabel && (
        <div className="text-[11px] text-zinc-500">
          Marketplace detected: <span className="text-zinc-300">{marketplaceLabel}</span>
          {marketplaceOverride && (
            <span className="text-amber-400"> (overridden to {marketplaceOverride})</span>
          )}
        </div>
      )}

      {/* Marketplace override dropdown */}
      {supportedMarketplaces.length > 0 && (
        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-300">
            Marketplace override <span className="text-zinc-500">(optional)</span>
          </label>
          <select
            value={marketplaceOverride}
            onChange={(e) => setMarketplaceOverride(e.target.value)}
            disabled={update.isPending}
            className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-zinc-500 disabled:opacity-50"
            data-testid="select-marketplace-override"
          >
            <option value="">Auto-detect from tag suffix</option>
            {supportedMarketplaces.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Force a specific Amazon marketplace regardless of your tag suffix. Useful if your
            account is linked to a different country than the standard suffix mapping.
          </p>
        </div>
      )}

      {/* Tag */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-zinc-300">
          Your Amazon Associates Tag
        </label>
        <input
          type="text"
          value={tag}
          onChange={(e) => {
            setTag(e.target.value);
            setTagError(validateTag(e.target.value));
          }}
          placeholder="myartist-20"
          disabled={isLoading || update.isPending}
          className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
          data-testid="input-amazon-tag"
        />
        {tagError && <p className="text-[11px] text-red-400">{tagError}</p>}
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Earn commissions from every Amazon purchase made via your storefront. Don't
          have one yet?{' '}
          <a
            href="https://affiliate-program.amazon.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline inline-flex items-center gap-0.5 hover:text-zinc-300"
          >
            Sign up free <ExternalLink className="w-3 h-3" />
          </a>
          . Leave blank to use the platform's default tag.
        </p>
      </div>

      {/* AI booster */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={boosterOn}
          onClick={() => setBoosterOn((v) => !v)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            boosterOn ? 'bg-emerald-500' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              boosterOn ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
        <div className="flex-1">
          <div className="text-xs font-medium text-zinc-200">
            AI Keyword Booster <span className="text-zinc-500">(only used when PA-API is enabled)</span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Use AI to generate 4–6 unique product searches based on your bio,
            aesthetic, and mood (in addition to the country + genre packs).
            Refreshes daily, cached 24h.
          </p>
        </div>
      </div>

      {/* Manual picks editor */}
      <div className="space-y-2 pt-3 border-t border-zinc-900">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5" style={{ color: colors.hexAccent }} />
            Manual Picks <span className="text-zinc-500">({manualPicks.length}/{MAX_MANUAL_PICKS})</span>
          </label>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Paste Amazon product links or ASINs. These display immediately on your
          storefront with your affiliate tag, even without PA-API access.
        </p>

        {/* Add new */}
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={newAsinInput}
              onChange={(e) => { setNewAsinInput(e.target.value); setAsinError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPick(); } }}
              placeholder="https://www.amazon.co.uk/dp/B0XXXXXXX  or  B0XXXXXXX"
              disabled={update.isPending}
              className="flex-1 px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
              data-testid="input-amazon-asin"
            />
            <button
              type="button"
              onClick={handleAddPick}
              disabled={update.isPending || manualPicks.length >= MAX_MANUAL_PICKS}
              className="px-2.5 py-1.5 rounded text-xs font-medium bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50 flex items-center gap-1"
              data-testid="button-add-asin"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
          <input
            type="text"
            value={newTitleInput}
            onChange={(e) => setNewTitleInput(e.target.value)}
            placeholder="Optional custom title (otherwise auto-generated)"
            disabled={update.isPending}
            className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
          />
          {asinError && <p className="text-[11px] text-red-400">{asinError}</p>}
        </div>

        {/* List */}
        {manualPicks.length > 0 && (
          <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {manualPicks.map((p) => (
              <li
                key={p.asin}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800"
              >
                <span className="text-[11px] font-mono text-zinc-400">{p.asin}</span>
                {p.title && <span className="text-xs text-zinc-200 truncate flex-1">{p.title}</span>}
                {!p.title && <span className="text-xs text-zinc-600 italic flex-1">auto-title</span>}
                <button
                  type="button"
                  onClick={() => handleRemovePick(p.asin)}
                  disabled={update.isPending}
                  className="text-zinc-500 hover:text-red-400 p-0.5"
                  aria-label={`Remove ${p.asin}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-900">
        {savedAt && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Saved
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={update.isPending || !!tagError}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="button-save-amazon-settings"
        >
          <Save className="w-3.5 h-3.5" />
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default AmazonAffiliateSettings;
