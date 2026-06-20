import { useState, useEffect } from 'react';
import { getConnectionInfo, saveConnectionInfo, clearConnectionInfo } from '../shared/storage';
import { validateConnectToken } from '../shared/api-client';
import { EXTENSION_ID } from '../shared/constants';
import type { ConnectionInfo, ExtractionJob, ExtractedUser } from '../shared/types';

type ExtractType = 'followers' | 'following' | 'hashtag' | 'location' | 'likers' | 'commenters';
interface ExtractConfig { id: ExtractType; icon: string; label: string; desc: string; inputLabel: string; inputPlaceholder: string; }

const EXTRACT_TYPES: ExtractConfig[] = [
  { id: 'followers',  icon: '👥', label: 'Followers',     desc: 'Extract follower list', inputLabel: 'Instagram Username', inputPlaceholder: '@username' },
  { id: 'following',  icon: '👤', label: 'Following',     desc: 'Extract following list', inputLabel: 'Instagram Username', inputPlaceholder: '@username' },
  { id: 'hashtag',    icon: '#️⃣', label: 'Hashtag Users', desc: 'Users from a hashtag', inputLabel: 'Hashtag', inputPlaceholder: '#music' },
  { id: 'location',   icon: '📍', label: 'Location',      desc: 'Users at a location', inputLabel: 'Location URL', inputPlaceholder: 'Paste Instagram location URL' },
  { id: 'likers',     icon: '❤️', label: 'Likers',        desc: 'Who liked a post', inputLabel: 'Post URL', inputPlaceholder: 'https://instagram.com/p/...' },
  { id: 'commenters', icon: '💬', label: 'Commenters',    desc: 'Who commented', inputLabel: 'Post URL', inputPlaceholder: 'https://instagram.com/p/...' },
];

const TOOLS = [
  { id: 'captions', icon: '✍️', label: 'Captions', desc: 'AI viral captions' },
  { id: 'hashtags', icon: '#️⃣', label: 'Hashtags', desc: '30 trending tags' },
  { id: 'ideas',    icon: '💡', label: 'Ideas',    desc: 'Content calendar' },
  { id: 'bio',      icon: '✨', label: 'Bio',      desc: 'Optimize your bio' },
  { id: 'timing',   icon: '⏰', label: 'Times',    desc: 'When to post' },
  { id: 'audit',    icon: '📊', label: 'Audit',    desc: 'Full review' },
];

export default function App() {
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenInput, setTokenInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<'home' | 'tools' | 'extract'>('home');
  const [detectedUser, setDetectedUser] = useState<{ username: string; profilePic?: string; profilePicUrl?: string } | null>(null);
  const [isOnInstagram, setIsOnInstagram] = useState(false);
  const [igTabId, setIgTabId] = useState<number | null>(null);

  const [selectedExtract, setSelectedExtract] = useState<ExtractType | null>(null);
  const [extractInput, setExtractInput] = useState('');
  const [extractMax, setExtractMax] = useState(200);
  const [extractSort, setExtractSort] = useState<'recent' | 'rank'>('recent');
  const [extracting, setExtracting] = useState(false);
  const [extractJob, setExtractJob] = useState<ExtractionJob | null>(null);
  const [extractResults, setExtractResults] = useState<ExtractedUser[]>([]);
  const [extractError, setExtractError] = useState('');
  const [toolLoading, setToolLoading] = useState(false);
  const [toolResult, setToolResult] = useState('');

  useEffect(() => { loadConnection(); detectInstagram(); }, []);

  useEffect(() => {
    if (!extracting) return;
    const interval = setInterval(async () => {
      try {
        const result = await chrome.runtime.sendMessage({ type: 'GET_EXTRACTION_STATUS' });
        if (result?.job) {
          setExtractJob(result.job);
          if (result.job.status === 'completed') { setExtracting(false); setExtractResults(result.job.results || []); }
          else if (result.job.status === 'failed') { setExtracting(false); setExtractError(result.job.error || 'Failed'); }
          else if (result.job.status === 'cancelled') { setExtracting(false); }
        }
      } catch {}
    }, 1500);
    return () => clearInterval(interval);
  }, [extracting]);

  async function detectInstagram() {
    try {
      const tabs = await chrome.tabs.query({ url: '*://www.instagram.com/*' });
      if (tabs.length > 0) { setIsOnInstagram(true); setIgTabId(tabs[0].id || null); }
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (active?.url?.includes('instagram.com')) { setIsOnInstagram(true); setIgTabId(active.id || null); }
      const r = await chrome.runtime.sendMessage({ type: 'GET_LOGGED_IN_USER' });
      if (r?.user) setDetectedUser(r.user);
    } catch {}
  }

  async function loadConnection() { setLoading(true); const c = await getConnectionInfo(); setConnection(c); setLoading(false); }

  async function handleConnect() {
    if (!tokenInput.trim()) return;
    setConnecting(true); setError('');
    try {
      const username = detectedUser?.username || 'unknown';
      const result = await validateConnectToken({ connectToken: tokenInput.trim(), extensionId: EXTENSION_ID, instagramUsername: username, profileUrl: '', displayName: username });
      if (result.success) {
        const connInfo: ConnectionInfo = { connectionId: result.connectionId, userId: result.userId, syncToken: result.syncToken, instagramUsername: result.instagramUsername, displayName: result.instagramUsername, status: 'active' };
        await saveConnectionInfo(connInfo); setConnection(connInfo); setTokenInput('');
        chrome.runtime.sendMessage({ type: 'SYNC_NOW' });
      }
    } catch (err: any) { setError(err.message || 'Connection failed'); }
    finally { setConnecting(false); }
  }

  async function handleDisconnect() { chrome.runtime.sendMessage({ type: 'DISCONNECT' }); await clearConnectionInfo(); setConnection(null); setView('home'); }
  async function handleSync() { setSyncing(true); try { await chrome.runtime.sendMessage({ type: 'SYNC_NOW' }); } catch {} setSyncing(false); }

  async function runTool(toolId: string) {
    setToolLoading(true); setToolResult('');
    try {
      if (igTabId) { await chrome.tabs.sendMessage(igTabId, { type: 'RUN_BOOSTIFY_TOOL', toolId, artistName: connection?.instagramUsername || '' }); setToolResult('Tool launched on Instagram page.'); }
      else { chrome.tabs.create({ url: 'http://localhost:5000/instagram-boost?tab=ai-tools&tool=' + toolId }); setToolResult('Opened in dashboard'); }
    } catch { chrome.tabs.create({ url: 'http://localhost:5000/instagram-boost?tab=ai-tools' }); setToolResult('Opened in dashboard'); }
    setToolLoading(false);
  }

  async function startExtraction() {
    if (!selectedExtract) return;
    const query = extractInput.trim().replace(/^[@#]/, '');
    if (!query) { setExtractError('Please enter a value'); return; }
    setExtracting(true); setExtractError(''); setExtractResults([]); setExtractJob(null);
    try {
      let targetUrl = '';
      if (selectedExtract === 'hashtag') targetUrl = 'https://www.instagram.com/explore/tags/' + encodeURIComponent(query) + '/';
      else if (selectedExtract === 'followers' || selectedExtract === 'following') targetUrl = 'https://www.instagram.com/' + encodeURIComponent(query) + '/';
      else if (selectedExtract === 'likers' || selectedExtract === 'commenters') targetUrl = query.includes('instagram.com') ? query : 'https://www.instagram.com/p/' + encodeURIComponent(query) + '/';
      else if (selectedExtract === 'location') targetUrl = query.includes('instagram.com') ? query : '';

      if (targetUrl) {
        if (igTabId) {
          await chrome.tabs.update(igTabId, { url: targetUrl, active: true });
        } else {
          const t = await chrome.tabs.create({ url: targetUrl });
          setIgTabId(t.id || null);
          setIsOnInstagram(true);
        }
        // Wait longer for Instagram SPA to fully load
        await new Promise(r => setTimeout(r, 5000));
      }

      const result = await chrome.runtime.sendMessage({ type: 'START_EXTRACTION', extractType: selectedExtract, query, sortMode: extractSort, maxUsers: extractMax, tabId: igTabId });
      if (result?.error) { setExtractError(result.error); setExtracting(false); }
    } catch (err: any) { setExtractError(err.message || 'Failed'); setExtracting(false); }
  }

  async function cancelExtraction() { try { await chrome.runtime.sendMessage({ type: 'CANCEL_EXTRACTION' }); } catch {} setExtracting(false); }

  function exportCSV() {
    if (!extractResults.length) return;
    const csv = 'Username,Display Name,Verified,Private,URL\n' + extractResults.map(u => u.username + ',"' + (u.displayName||'').replace(/"/g,'""') + '",' + (u.isVerified||false) + ',' + (u.isPrivate||false) + ',https://instagram.com/' + u.username).join('\n');
    const b = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = url; a.download = 'boostify-extract-' + selectedExtract + '-' + Date.now() + '.csv'; a.click(); URL.revokeObjectURL(url);
  }

  function exportJSON() {
    if (!extractResults.length) return;
    const b = new Blob([JSON.stringify(extractResults, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = url; a.download = 'boostify-extract-' + selectedExtract + '-' + Date.now() + '.json'; a.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <div className="flex items-center justify-center h-[500px] bg-[#0a0a0f]"><div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="w-full min-h-[520px] bg-[#0a0a0f] text-white flex flex-col">
      <div className="p-3 bg-gradient-to-br from-purple-600/30 via-pink-600/20 to-orange-600/10 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          {(detectedUser?.profilePic || detectedUser?.profilePicUrl) ? <img src={detectedUser.profilePic || detectedUser.profilePicUrl} className="w-9 h-9 rounded-xl border-2 border-pink-500/40 object-cover" /> : <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">B</div>}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold truncate">{detectedUser?.username ? '@' + detectedUser.username : connection?.instagramUsername ? '@' + connection.instagramUsername : 'Boostify'}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {isOnInstagram && <span className="flex items-center gap-1 text-[10px] text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />IG Active</span>}
              {connection && <span className="flex items-center gap-1 text-[10px] text-purple-400"><span className="w-1.5 h-1.5 rounded-full bg-purple-400" />Synced</span>}
            </div>
          </div>
        </div>
      </div>

      {!connection ? (
        <div className="flex-1 p-4 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center"><span className="text-3xl">🔗</span></div>
          <div className="text-center"><h3 className="text-base font-bold">Connect to Boostify</h3><p className="text-xs text-white/40 mt-1">Paste your connection token from the dashboard</p></div>
          <div className="w-full space-y-2">
            <input type="text" value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="Paste token here..." className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm placeholder:text-white/25 focus:outline-none focus:border-pink-500/50" onKeyDown={e => e.key === 'Enter' && handleConnect()} />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button onClick={handleConnect} disabled={connecting || !tokenInput.trim()} className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 font-semibold text-sm disabled:opacity-50">{connecting ? 'Connecting...' : 'Connect'}</button>
            <button onClick={() => chrome.tabs.create({ url: 'http://localhost:5000/instagram-boost' })} className="w-full text-center text-xs text-pink-400 py-1">Get token → Dashboard</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex border-b border-white/[0.06]">
            {[{id:'home',icon:'🏠',label:'Home'},{id:'tools',icon:'⚡',label:'AI Tools'},{id:'extract',icon:'📥',label:'Extract'}].map(tab => (
              <button key={tab.id} onClick={() => { setView(tab.id as any); setToolResult(''); }} className={'flex-1 py-2 text-center text-[11px] font-medium border-b-2 ' + (view === tab.id ? 'border-pink-500 text-pink-400' : 'border-transparent text-white/40 hover:text-white/60')}>
                <span className="text-sm block">{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {view === 'home' && <>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleSync} disabled={syncing} className="py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 font-semibold text-xs disabled:opacity-50">{syncing ? 'Syncing...' : '🔄 Sync Now'}</button>
                <button onClick={() => chrome.tabs.create({ url: 'http://localhost:5000/instagram-boost' })} className="py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] font-medium text-xs">📊 Dashboard</button>
              </div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Quick Tools</p>
              <div className="grid grid-cols-3 gap-2">
                {TOOLS.slice(0,3).map(t => <button key={t.id} onClick={() => { setView('tools'); runTool(t.id); }} className="rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] p-2.5 text-center"><span className="text-lg block">{t.icon}</span><span className="text-[10px] text-white/60 block">{t.label}</span></button>)}
              </div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Quick Extract</p>
              <div className="grid grid-cols-3 gap-2">
                {EXTRACT_TYPES.slice(0,3).map(t => <button key={t.id} onClick={() => { setView('extract'); setSelectedExtract(t.id); }} className="rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] p-2.5 text-center"><span className="text-lg block">{t.icon}</span><span className="text-[10px] text-white/60 block">{t.label}</span></button>)}
              </div>
              <button onClick={handleDisconnect} className="w-full py-1.5 text-red-400/50 hover:text-red-400 text-[10px]">Disconnect</button>
            </>}

            {view === 'tools' && <>
              {!isOnInstagram && <div className="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2"><span>⚠️</span><p className="text-[11px] text-yellow-400">Open Instagram for in-page tools</p></div>}
              <div className="grid grid-cols-2 gap-2">
                {TOOLS.map(t => <button key={t.id} onClick={() => runTool(t.id)} disabled={toolLoading} className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] p-3 text-left disabled:opacity-50"><span className="text-xl">{t.icon}</span><p className="text-xs font-semibold mt-1">{t.label}</p><p className="text-[10px] text-white/40">{t.desc}</p></button>)}
              </div>
              {toolResult && <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/70">{toolResult}</div>}
            </>}

            {view === 'extract' && <>
              {!extracting && extractResults.length === 0 && <>
                <p className="text-xs font-semibold text-white/70">1. Select Extract Type</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {EXTRACT_TYPES.map(t => <button key={t.id} onClick={() => { setSelectedExtract(t.id); setExtractInput(''); setExtractError(''); }} className={'rounded-xl border p-2.5 text-center transition-all ' + (selectedExtract === t.id ? 'bg-blue-500/15 border-blue-500/40 ring-1 ring-blue-500/20' : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]')}><span className="text-lg block">{t.icon}</span><span className="text-[10px] font-medium block mt-0.5">{t.label}</span></button>)}
                </div>

                {selectedExtract && <>
                  <p className="text-xs font-semibold text-white/70">2. {EXTRACT_TYPES.find(t => t.id === selectedExtract)?.inputLabel}</p>
                  <input type="text" value={extractInput} onChange={e => setExtractInput(e.target.value)} placeholder={EXTRACT_TYPES.find(t => t.id === selectedExtract)?.inputPlaceholder} className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm placeholder:text-white/25 focus:outline-none focus:border-blue-500/50" onKeyDown={e => e.key === 'Enter' && startExtraction()} />

                  <p className="text-xs font-semibold text-white/70">3. Options</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-white/40 mb-1 block">Sort By</label>
                      <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
                        <button onClick={() => setExtractSort('recent')} className={'flex-1 py-2 text-[11px] font-medium ' + (extractSort === 'recent' ? 'bg-blue-500 text-white' : 'bg-white/[0.03] text-white/50')}>Recent</button>
                        <button onClick={() => setExtractSort('rank')} className={'flex-1 py-2 text-[11px] font-medium ' + (extractSort === 'rank' ? 'bg-blue-500 text-white' : 'bg-white/[0.03] text-white/50')}>Top</button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-white/40 mb-1 block">Max Users</label>
                      <select value={extractMax} onChange={e => setExtractMax(Number(e.target.value))} className="w-full py-2 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none">
                        <option value={50}>50</option><option value={100}>100</option><option value={200}>200</option><option value={500}>500</option><option value={1000}>1000</option>
                      </select>
                    </div>
                  </div>

                  {extractError && <p className="text-red-400 text-xs">❌ {extractError}</p>}

                  <button onClick={startExtraction} disabled={!extractInput.trim()} className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                    <span>📥</span> EXTRACT
                  </button>

                  <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[10px] text-white/40 text-center">The extension will navigate to the right page and start extracting automatically</p>
                  </div>
                </>}
              </>}

              {extracting && <div className="space-y-3">
                <div className="text-center py-4">
                  <div className="w-16 h-16 mx-auto mb-3 relative">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-500/20" />
                    <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl">{EXTRACT_TYPES.find(t => t.id === selectedExtract)?.icon}</span></div>
                  </div>
                  <p className="text-sm font-bold">Extracting {selectedExtract}...</p>
                  <p className="text-xs text-white/40 mt-1">{extractInput.replace(/^[@#]/, '')}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-white/50"><span>{extractJob?.progress || 0} found</span><span>max {extractMax}</span></div>
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500" style={{ width: Math.min(100, ((extractJob?.progress || 0) / extractMax) * 100) + '%' }} /></div>
                </div>
                {['Navigating to page', 'Opening dialog', 'Scrolling & collecting', 'Processing'].map((step, i) => {
                  const p = extractJob?.progress || 0; const done = i < (p > 0 ? 3 : 1); const active = !done && i <= (p > 0 ? 3 : 1);
                  return <div key={step} className="flex items-center gap-2 text-xs">
                    {done ? <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-[10px]">✓</span> : active ? <span className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" /></span> : <span className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-white/20" /></span>}
                    <span className={done ? 'text-green-400/70' : active ? 'text-white' : 'text-white/30'}>{step}</span>
                  </div>;
                })}
                <button onClick={cancelExtraction} className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-medium">Cancel</button>
              </div>}

              {!extracting && extractResults.length > 0 && <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-bold text-green-400">✅ Complete</p><p className="text-[10px] text-white/40">{extractResults.length} users extracted & saved to DB</p></div>
                  <button onClick={() => { setExtractResults([]); setSelectedExtract(null); setExtractInput(''); }} className="text-[10px] text-white/40 hover:text-white/60 px-2 py-1 rounded-lg bg-white/[0.04]">New</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={exportCSV} className="flex-1 py-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 text-xs font-medium">📄 CSV</button>
                  <button onClick={exportJSON} className="flex-1 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-xs font-medium">📋 JSON</button>
                </div>
                <div className="max-h-[200px] overflow-y-auto space-y-1 rounded-xl border border-white/[0.06] p-2">
                  {extractResults.slice(0, 50).map((u, i) => <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/[0.03]">
                    {u.profilePicUrl ? <img src={u.profilePicUrl} className="w-7 h-7 rounded-full object-cover" /> : <div className="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] text-white/30">{u.username?.charAt(0)?.toUpperCase()}</div>}
                    <div className="flex-1 min-w-0"><p className="text-[11px] font-medium truncate">@{u.username}{u.isVerified && <span className="ml-1 text-blue-400">✓</span>}</p>{u.displayName && <p className="text-[9px] text-white/30 truncate">{u.displayName}</p>}</div>
                    {u.isPrivate && <span className="text-[9px] text-white/30 px-1.5 py-0.5 rounded bg-white/[0.04]">🔒</span>}
                  </div>)}
                  {extractResults.length > 50 && <p className="text-center text-[10px] text-white/30 py-2">+ {extractResults.length - 50} more (export to see all)</p>}
                </div>
                <button onClick={() => chrome.tabs.create({ url: 'http://localhost:5000/instagram-boost?tab=extension' })} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/20 text-xs font-medium text-purple-300">📊 Manage in Dashboard</button>
              </div>}
            </>}
          </div>

          <div className="flex-shrink-0 px-3 py-1.5 border-t border-white/[0.06] text-center"><p className="text-[9px] text-white/15">Boostify v1.0.0</p></div>
        </>
      )}
    </div>
  );
}
