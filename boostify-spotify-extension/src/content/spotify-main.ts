// Boostify Spotify Content Script — runs on open.spotify.com
console.log('[Boostify SP] Content script loaded');

function detectCurrentPage(): { type: string; id?: string; name?: string } {
  const path = window.location.pathname;
  if (path.startsWith('/artist/')) return { type: 'artist', id: path.split('/')[2] };
  if (path.startsWith('/playlist/')) return { type: 'playlist', id: path.split('/')[2] };
  if (path.startsWith('/album/')) return { type: 'album', id: path.split('/')[2] };
  if (path.startsWith('/track/')) return { type: 'track', id: path.split('/')[2] };
  if (path.startsWith('/user/')) return { type: 'user', id: path.split('/')[2] };
  if (path === '/' || path === '/collection') return { type: 'home' };
  if (path.startsWith('/search')) return { type: 'search' };
  return { type: 'other' };
}

function scrapeArtistPage(): any | null {
  try {
    const nameEl = document.querySelector('[data-testid="entityTitle"] h1, header h1, .artist-title');
    const listenersEl = document.querySelector('[data-testid="monthly-listeners-label"], .listeners-count');
    const verifiedEl = document.querySelector('[data-testid="verified-badge"], .verified-artist-badge');
    const imgEl = document.querySelector('[data-testid="entity-image"] img, header img, .artist-image img') as HTMLImageElement;

    let monthlyListeners = 0;
    if (listenersEl) {
      const text = listenersEl.textContent || '';
      const num = text.replace(/[^0-9]/g, '');
      monthlyListeners = parseInt(num, 10) || 0;
    }

    return {
      displayName: nameEl?.textContent?.trim() || null,
      monthlyListeners,
      isVerified: !!verifiedEl,
      profilePicUrl: imgEl?.src || null,
    };
  } catch {
    return null;
  }
}

function scrapePlaylistPage(): any | null {
  try {
    const nameEl = document.querySelector('[data-testid="entityTitle"] h1, .playlist-name');
    const ownerEl = document.querySelector('[data-testid="entityTitle"] a, .playlist-owner a');
    const followersEl = document.querySelector('.playlist-followers, [data-testid="playlist-followers"]');
    const trackCountEl = document.querySelector('.tracklist-header .tracklist-content-length, [data-testid="playlist-tracklist"] [aria-label]');

    let followers = 0;
    if (followersEl) {
      const num = (followersEl.textContent || '').replace(/[^0-9]/g, '');
      followers = parseInt(num, 10) || 0;
    }

    return {
      name: nameEl?.textContent?.trim() || null,
      owner: ownerEl?.textContent?.trim() || null,
      ownerUrl: (ownerEl as HTMLAnchorElement)?.href || null,
      followers,
    };
  } catch {
    return null;
  }
}

// Auto-detect and report to background
async function autoReport() {
  const page = detectCurrentPage();
  
  if (page.type === 'artist') {
    const data = scrapeArtistPage();
    if (data && data.displayName) {
      chrome.runtime.sendMessage({
        type: 'PROFILE_DETECTED',
        username: page.id,
        displayName: data.displayName,
        profilePicUrl: data.profilePicUrl,
        profile: {
          username: page.id,
          displayName: data.displayName,
          profilePicUrl: data.profilePicUrl || '',
          monthlyListeners: data.monthlyListeners,
          followers: 0,
          playlistCount: 0,
          totalStreams: 0,
          topCities: [],
          isVerified: data.isVerified,
          genres: [],
        }
      });
    }
  }
}

// Create floating Boostify button
function createBoostifyButton() {
  if (document.getElementById('boostify-sp-btn')) return;

  const btn = document.createElement('div');
  btn.id = 'boostify-sp-btn';
  btn.innerHTML = `
    <div style="position:fixed; bottom:80px; right:20px; z-index:9999; cursor:pointer;">
      <div style="width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg, #1DB954, #191414); display:flex; align-items:center; justify-content:center; box-shadow:0 4px 15px rgba(29,185,84,0.4); transition:transform 0.2s;" 
        onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
      </div>
    </div>
  `;

  btn.addEventListener('click', () => {
    toggleOverlay();
  });

  document.body.appendChild(btn);
}

let overlayOpen = false;

function toggleOverlay() {
  const existing = document.getElementById('boostify-sp-overlay');
  if (existing) {
    existing.remove();
    overlayOpen = false;
    return;
  }

  overlayOpen = true;
  const overlay = document.createElement('div');
  overlay.id = 'boostify-sp-overlay';
  overlay.innerHTML = `
    <div style="position:fixed; top:0; right:0; width:360px; height:100vh; background:#121212; border-left:1px solid #282828; z-index:99999; overflow-y:auto; font-family:-apple-system,BlinkMacSystemFont,sans-serif; color:#fff;">
      <div style="padding:16px; border-bottom:1px solid #282828; display:flex; align-items:center; gap:10px;">
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#1DB954,#191414);display:flex;align-items:center;justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        </div>
        <div>
          <div style="font-weight:700;font-size:14px;">Boostify Tools</div>
          <div style="font-size:11px;color:#b3b3b3;">AI-powered Spotify growth</div>
        </div>
        <div style="margin-left:auto;cursor:pointer;padding:4px;" onclick="document.getElementById('boostify-sp-overlay').remove()">✕</div>
      </div>
      <div style="padding:12px; display:grid; gap:8px;" id="boostify-sp-tools">
        ${['Playlist Pitch', 'SEO Optimizer', 'Growth Plan', 'Full Audit', 'Bio Optimizer', 'Release Strategy'].map((tool, i) => `
          <div class="boostify-sp-tool" data-action="${['generate-pitch','optimize-seo','growth-plan','full-audit','bio-optimizer','release-plan'][i]}" 
            style="padding:12px;background:#1a1a1a;border-radius:8px;cursor:pointer;border:1px solid #282828;transition:all 0.2s;"
            onmouseover="this.style.borderColor='#1DB954'" onmouseout="this.style.borderColor='#282828'">
            <div style="font-size:13px;font-weight:600;">${tool}</div>
            <div style="font-size:11px;color:#b3b3b3;margin-top:2px;">${['Generate curator pitch emails', 'Optimize track & profile SEO', 'AI 4-week growth strategy', 'Complete profile analysis', 'Optimize your artist bio', 'Plan your next release'][i]}</div>
          </div>
        `).join('')}
      </div>
      <div id="boostify-sp-result" style="padding:12px;display:none;">
        <div style="font-size:12px;color:#b3b3b3;text-align:center;padding:20px;">Running tool...</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Wire tool clicks
  overlay.querySelectorAll('.boostify-sp-tool').forEach(el => {
    el.addEventListener('click', async () => {
      const action = (el as HTMLElement).dataset.action;
      const resultDiv = document.getElementById('boostify-sp-result');
      const toolsDiv = document.getElementById('boostify-sp-tools');
      if (resultDiv && toolsDiv) {
        toolsDiv.style.display = 'none';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:24px;animation:spin 1s linear infinite;">⟳</div><div style="font-size:12px;color:#b3b3b3;margin-top:8px;">Running AI analysis...</div></div>';

        try {
          const res = await fetch(`http://localhost:5000/api/spotify/ai-agent/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action, params: {} })
          });
          const data = await res.json();
          resultDiv.innerHTML = `
            <div style="padding:4px;">
              <button onclick="document.getElementById('boostify-sp-tools').style.display='grid';document.getElementById('boostify-sp-result').style.display='none'" 
                style="font-size:11px;color:#1DB954;background:none;border:none;cursor:pointer;margin-bottom:8px;">← Back to tools</button>
              <pre style="font-size:11px;color:#e0e0e0;white-space:pre-wrap;background:#1a1a1a;padding:12px;border-radius:8px;max-height:70vh;overflow-y:auto;">${JSON.stringify(data.result || data, null, 2)}</pre>
            </div>
          `;
        } catch (e: any) {
          resultDiv.innerHTML = `<div style="color:#f44;padding:12px;font-size:12px;">Error: ${e.message}<br><a href="http://localhost:5000/spotify" target="_blank" style="color:#1DB954;">Open Boostify Dashboard →</a></div>`;
        }
      }
    });
  });
}

// Handle extraction messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PING') {
    sendResponse({ pong: true });
    return true;
  }

  if (msg.type === 'START_EXTRACTION') {
    handleExtraction(msg).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === 'RUN_TOOL') {
    // Open overlay and run tool
    if (!overlayOpen) toggleOverlay();
    sendResponse({ success: true });
    return true;
  }
});

async function handleExtraction(msg: any) {
  const { extractType, query, maxResults } = msg;
  const results: any[] = [];

  try {
    chrome.runtime.sendMessage({ type: 'EXTRACTION_PROGRESS', progress: 0, total: maxResults });

    if (extractType === 'playlist_followers' || extractType === 'playlist_curators') {
      // Navigate to playlist and scrape followers
      const playlistData = scrapePlaylistPage();
      if (playlistData) {
        results.push({
          displayName: playlistData.owner,
          playlistName: playlistData.name,
          playlistFollowers: playlistData.followers,
          profileUrl: playlistData.ownerUrl,
          isCurator: true,
        });
      }
    }

    chrome.runtime.sendMessage({
      type: 'EXTRACTION_COMPLETE',
      extractType,
      query,
      results,
      total: results.length,
    });

    return { success: true, count: results.length };
  } catch (e: any) {
    return { error: e.message };
  }
}

// Initialize
setTimeout(() => {
  createBoostifyButton();
  autoReport();
}, 3000);

// Watch for SPA navigation
let lastPath = location.pathname;
setInterval(() => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    autoReport();
  }
}, 2000);
