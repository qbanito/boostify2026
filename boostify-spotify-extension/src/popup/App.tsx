import React from 'react';
import { createRoot } from 'react-dom/client';

const API_BASE = 'http://localhost:5000/api/spotify-ext';
const AI_BASE = 'http://localhost:5000/api/spotify/ai-agent';

type Tab = 'home' | 'tools' | 'extract';

function App() {
  const [tab, setTab] = React.useState<Tab>('home');
  const [status, setStatus] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [toolResult, setToolResult] = React.useState<any>(null);
  const [runningTool, setRunningTool] = React.useState('');

  React.useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
      setStatus(res);
      setLoading(false);
    });
  }, []);

  async function runTool(action: string, label: string) {
    setRunningTool(label);
    setToolResult(null);
    try {
      const res = await fetch(`${AI_BASE}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, params: {} })
      });
      const data = await res.json();
      setToolResult(data);
    } catch (e: any) {
      setToolResult({ error: e.message });
    }
    setRunningTool('');
  }

  const styles = {
    container: { padding: '16px', minHeight: '480px' },
    header: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #282828' },
    logo: { width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #1DB954, #191414)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    tabs: { display: 'flex', gap: '4px', marginBottom: '16px', background: '#1a1a1a', borderRadius: '8px', padding: '3px' },
    tab: (active: boolean) => ({
      flex: 1, padding: '8px 4px', textAlign: 'center' as const, fontSize: '11px', fontWeight: active ? '700' : '400',
      background: active ? '#1DB954' : 'transparent', color: active ? '#000' : '#b3b3b3',
      borderRadius: '6px', cursor: 'pointer', border: 'none', transition: 'all 0.2s'
    }),
    stat: { textAlign: 'center' as const, padding: '12px', background: '#1a1a1a', borderRadius: '8px' },
    statNum: { fontSize: '20px', fontWeight: '700', color: '#1DB954' },
    statLabel: { fontSize: '10px', color: '#b3b3b3', marginTop: '2px' },
    tool: { padding: '12px', background: '#1a1a1a', borderRadius: '8px', cursor: 'pointer', border: '1px solid #282828', marginBottom: '8px' },
    toolTitle: { fontSize: '13px', fontWeight: '600' },
    toolDesc: { fontSize: '11px', color: '#b3b3b3', marginTop: '2px' },
    badge: (color: string) => ({
      display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '10px',
      background: color === 'green' ? 'rgba(29,185,84,0.2)' : 'rgba(255,68,68,0.2)',
      color: color === 'green' ? '#1DB954' : '#f44'
    }),
    link: { color: '#1DB954', textDecoration: 'none', fontSize: '12px' },
  };

  if (loading) {
    return React.createElement('div', { style: { ...styles.container, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      React.createElement('div', { style: { textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: '24px', marginBottom: '8px' } }, '⟳'),
        React.createElement('div', { style: { fontSize: '12px', color: '#b3b3b3' } }, 'Loading...')
      )
    );
  }

  const connected = status?.connected;
  const profile = status?.profile;

  return React.createElement('div', { style: styles.container },
    // Header
    React.createElement('div', { style: styles.header },
      React.createElement('div', { style: styles.logo },
        React.createElement('span', { style: { color: '#fff', fontSize: '14px' } }, '⚡')
      ),
      React.createElement('div', null,
        React.createElement('div', { style: { fontWeight: '700', fontSize: '14px' } }, 'Boostify Spotify'),
        React.createElement('div', { style: { fontSize: '11px', color: '#b3b3b3' } },
          connected ? `@${profile?.displayName || 'Artist'}` : 'Not connected'
        )
      ),
      React.createElement('span', { style: styles.badge(connected ? 'green' : 'red') },
        connected ? 'Connected' : 'Offline'
      )
    ),

    // Tabs
    React.createElement('div', { style: styles.tabs },
      ['home', 'tools', 'extract'].map(t =>
        React.createElement('button', {
          key: t, style: styles.tab(tab === t),
          onClick: () => { setTab(t as Tab); setToolResult(null); }
        }, t === 'home' ? '🏠 Home' : t === 'tools' ? '🔧 Tools' : '📊 Extract')
      )
    ),

    // Home Tab
    tab === 'home' && React.createElement('div', null,
      connected && profile ? React.createElement('div', null,
        React.createElement('div', { style: { display:'flex', gap:'8px', marginBottom:'12px' } },
          React.createElement('div', { style: { ...styles.stat, flex:1 } },
            React.createElement('div', { style: styles.statNum }, (profile.monthlyListeners || 0).toLocaleString()),
            React.createElement('div', { style: styles.statLabel }, 'Monthly Listeners')
          ),
          React.createElement('div', { style: { ...styles.stat, flex:1 } },
            React.createElement('div', { style: styles.statNum }, (profile.followers || 0).toLocaleString()),
            React.createElement('div', { style: styles.statLabel }, 'Followers')
          )
        ),
        React.createElement('div', { style: { textAlign:'center', marginTop:'16px' } },
          React.createElement('a', { href: 'http://localhost:5000/spotify', target: '_blank', style: styles.link }, 'Open Full Dashboard →')
        )
      ) : React.createElement('div', { style: { textAlign:'center', padding:'40px 12px' } },
        React.createElement('div', { style: { fontSize:'32px', marginBottom:'12px' } }, '🎵'),
        React.createElement('div', { style: { fontSize:'14px', fontWeight:'600', marginBottom:'8px' } }, 'Connect to Spotify'),
        React.createElement('div', { style: { fontSize:'12px', color:'#b3b3b3', marginBottom:'16px' } }, 'Log in to open.spotify.com to auto-detect your profile'),
        React.createElement('a', {
          href: 'https://open.spotify.com', target: '_blank',
          style: { ...styles.link, padding:'10px 24px', background:'#1DB954', color:'#000', borderRadius:'24px', fontWeight:'700', display:'inline-block', textDecoration:'none' }
        }, 'Open Spotify')
      )
    ),

    // Tools Tab
    tab === 'tools' && React.createElement('div', null,
      toolResult ? React.createElement('div', null,
        React.createElement('button', {
          onClick: () => setToolResult(null),
          style: { fontSize:'11px', color:'#1DB954', background:'none', border:'none', cursor:'pointer', marginBottom:'8px' }
        }, '← Back'),
        React.createElement('pre', {
          style: { fontSize:'11px', color:'#e0e0e0', whiteSpace:'pre-wrap', background:'#1a1a1a', padding:'12px', borderRadius:'8px', maxHeight:'350px', overflowY:'auto' }
        }, JSON.stringify(toolResult.result || toolResult, null, 2))
      ) : React.createElement('div', null,
        [
          { action: 'generate-pitch', label: 'Playlist Pitch', desc: 'Generate curator pitch emails' },
          { action: 'optimize-seo', label: 'SEO Optimizer', desc: 'Optimize track & profile metadata' },
          { action: 'growth-plan', label: 'Growth Plan', desc: 'AI 4-week growth strategy' },
          { action: 'full-audit', label: 'Full Audit', desc: 'Complete profile analysis' },
          { action: 'bio-optimizer', label: 'Bio Optimizer', desc: 'Optimize your artist bio' },
          { action: 'release-plan', label: 'Release Strategy', desc: 'Plan your next release' },
        ].map(t =>
          React.createElement('div', {
            key: t.action, style: styles.tool,
            onClick: () => runTool(t.action, t.label),
            onMouseOver: (e: any) => e.currentTarget.style.borderColor = '#1DB954',
            onMouseOut: (e: any) => e.currentTarget.style.borderColor = '#282828'
          },
            React.createElement('div', { style: styles.toolTitle },
              runningTool === t.label ? '⟳ ' : '', t.label
            ),
            React.createElement('div', { style: styles.toolDesc }, t.desc)
          )
        )
      )
    ),

    // Extract Tab
    tab === 'extract' && React.createElement('div', null,
      React.createElement('div', { style: { textAlign:'center', padding:'30px 12px' } },
        React.createElement('div', { style: { fontSize:'28px', marginBottom:'12px' } }, '📊'),
        React.createElement('div', { style: { fontSize:'14px', fontWeight:'600', marginBottom:'8px' } }, 'Data Extraction'),
        React.createElement('div', { style: { fontSize:'12px', color:'#b3b3b3', marginBottom:'16px', lineHeight:'1.5' } },
          'Extract playlist curators, followers, and listener data from Spotify. Use the full dashboard for advanced extraction.'
        ),
        React.createElement('a', {
          href: 'http://localhost:5000/spotify', target: '_blank',
          style: { ...styles.link, padding:'10px 24px', background:'#1DB954', color:'#000', borderRadius:'24px', fontWeight:'700', display:'inline-block', textDecoration:'none' }
        }, 'Open Dashboard →')
      )
    )
  );
}

// Mount React app
const root = createRoot(document.getElementById('root')!);
root.render(React.createElement(App));
