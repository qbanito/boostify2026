// Boostify YouTube Extension — Auto-fill helper for YouTube Studio
// Fills in title, description, tags fields in the video editor

/**
 * Auto-fill the title field in YouTube Studio video editor
 */
export async function autoFillTitle(newTitle: string): Promise<boolean> {
  try {
    const titleTextarea = document.querySelector('#title-textarea textarea, #textbox[aria-label*="title"], [name="title"]') as HTMLTextAreaElement;
    if (!titleTextarea) {
      console.warn('[Boostify] Title textarea not found');
      return false;
    }
    
    // Clear and set value
    titleTextarea.focus();
    titleTextarea.value = newTitle;
    titleTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    titleTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    
    console.log(`[Boostify] Title auto-filled: "${newTitle}"`);
    return true;
  } catch (error) {
    console.error('[Boostify] Error auto-filling title:', error);
    return false;
  }
}

/**
 * Auto-fill the description field in YouTube Studio video editor
 */
export async function autoFillDescription(newDesc: string): Promise<boolean> {
  try {
    const descTextarea = document.querySelector('#description-textarea textarea, #textbox[aria-label*="description"], [name="description"]') as HTMLTextAreaElement;
    if (!descTextarea) {
      console.warn('[Boostify] Description textarea not found');
      return false;
    }
    
    descTextarea.focus();
    descTextarea.value = newDesc;
    descTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    descTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    
    console.log('[Boostify] Description auto-filled');
    return true;
  } catch (error) {
    console.error('[Boostify] Error auto-filling description:', error);
    return false;
  }
}

/**
 * Auto-fill tags in YouTube Studio
 * This is more complex because Studio uses a chips/pills interface for tags
 */
export async function autoFillTags(tags: string[]): Promise<boolean> {
  try {
    // YouTube Studio tags section - click "Show More" first if needed
    const showMoreBtn = document.querySelector('ytcp-button[id="toggle-button"], button[aria-label*="more options"], #toggle-button');
    if (showMoreBtn) {
      (showMoreBtn as HTMLElement).click();
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Find the tags input
    const tagsInput = document.querySelector('#tags-container input, #text-input[aria-label*="tags"], [placeholder*="tag"]') as HTMLInputElement;
    if (!tagsInput) {
      console.warn('[Boostify] Tags input not found');
      return false;
    }
    
    // Add tags one by one
    for (const tag of tags) {
      tagsInput.focus();
      tagsInput.value = tag;
      tagsInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Press Enter to confirm the tag
      tagsInput.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        bubbles: true,
      }));
      
      await new Promise(r => setTimeout(r, 200));
    }
    
    console.log(`[Boostify] ${tags.length} tags auto-filled`);
    return true;
  } catch (error) {
    console.error('[Boostify] Error auto-filling tags:', error);
    return false;
  }
}

/**
 * Show a confirmation overlay before applying changes
 */
export function showApplyConfirmation(action: string, details: string, onConfirm: () => void, onCancel: () => void): void {
  // Remove existing overlay
  document.querySelector('#boostify-confirm-overlay')?.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'boostify-confirm-overlay';
  overlay.className = 'boostify-confirm-overlay';
  overlay.innerHTML = `
    <div class="boostify-confirm-dialog">
      <div class="boostify-confirm-header">
        <span>🚀 Boostify Action</span>
      </div>
      <div class="boostify-confirm-body">
        <h3>${action}</h3>
        <p>${details}</p>
      </div>
      <div class="boostify-confirm-actions">
        <button class="boostify-btn boostify-btn-cancel" id="boostify-cancel">Skip</button>
        <button class="boostify-btn boostify-btn-confirm" id="boostify-confirm">Apply Changes</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  document.getElementById('boostify-confirm')?.addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
  
  document.getElementById('boostify-cancel')?.addEventListener('click', () => {
    overlay.remove();
    onCancel();
  });
}
