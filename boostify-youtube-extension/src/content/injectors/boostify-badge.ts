// Boostify YouTube Extension — Boostify Badge Injector
// Injects Boostify score badges and UI elements into YouTube pages

/**
 * Inject a Boostify score badge on a video thumbnail or player
 */
export function injectBoostifyBadge(videoId: string, score: number): void {
  // Don't inject if already exists
  if (document.querySelector(`[data-boostify-badge="${videoId}"]`)) return;
  
  const badge = document.createElement('div');
  badge.setAttribute('data-boostify-badge', videoId);
  badge.className = 'boostify-badge';
  badge.innerHTML = `
    <div class="boostify-badge-inner">
      <span class="boostify-badge-icon">🚀</span>
      <span class="boostify-badge-score">${score.toFixed(1)}</span>
    </div>
  `;
  
  // Try to find the video's thumbnail container
  const thumbnails = document.querySelectorAll(`a[href*="${videoId}"] #thumbnail, a[href*="${videoId}"] .thumbnail`);
  thumbnails.forEach((thumb) => {
    if (!thumb.querySelector(`[data-boostify-badge]`)) {
      const container = thumb as HTMLElement;
      container.style.position = 'relative';
      const badgeClone = badge.cloneNode(true) as HTMLElement;
      container.appendChild(badgeClone);
    }
  });
}

/**
 * Inject the "Analyze in Boostify" button below a video
 */
export function injectAnalyzeButton(videoId: string): void {
  if (document.querySelector('#boostify-analyze-btn')) return;
  
  const container = document.querySelector('#top-level-buttons-computed, #menu-container');
  if (!container) return;
  
  const btn = document.createElement('button');
  btn.id = 'boostify-analyze-btn';
  btn.className = 'boostify-analyze-btn';
  btn.innerHTML = `
    <span class="boostify-btn-icon">🚀</span>
    <span class="boostify-btn-text">Boostify</span>
  `;
  btn.title = 'Analyze this video with Boostify AI';
  
  btn.addEventListener('click', () => {
    // Open Boostify with this video pre-loaded
    const url = `https://boostifymusic.com/youtube-views?videoId=${videoId}`;
    window.open(url, '_blank');
  });
  
  container.appendChild(btn);
}

/**
 * Inject SEO hints tooltip for the current video
 */
export function injectSeoHints(hints: { title: string; description: string; tags: string[] }): void {
  if (document.querySelector('#boostify-seo-panel')) return;
  
  const panel = document.createElement('div');
  panel.id = 'boostify-seo-panel';
  panel.className = 'boostify-seo-panel';
  panel.innerHTML = `
    <div class="boostify-seo-header">
      <span>🚀 Boostify SEO</span>
      <button class="boostify-seo-close" id="boostify-seo-close">✕</button>
    </div>
    <div class="boostify-seo-content">
      ${hints.title ? `<div class="boostify-seo-item">
        <span class="boostify-seo-label">Suggested Title:</span>
        <span class="boostify-seo-value">${hints.title}</span>
      </div>` : ''}
      ${hints.tags?.length > 0 ? `<div class="boostify-seo-item">
        <span class="boostify-seo-label">Suggested Tags:</span>
        <div class="boostify-seo-tags">
          ${hints.tags.map(t => `<span class="boostify-tag">${t}</span>`).join('')}
        </div>
      </div>` : ''}
    </div>
  `;
  
  document.body.appendChild(panel);
  
  document.getElementById('boostify-seo-close')?.addEventListener('click', () => {
    panel.remove();
  });
}

/**
 * Remove all Boostify injected elements
 */
export function removeAllBoostifyElements(): void {
  document.querySelectorAll('[data-boostify-badge], #boostify-analyze-btn, #boostify-seo-panel, .boostify-badge').forEach(el => el.remove());
}
