import { readFileSync, writeFileSync } from 'fs';

const file = 'client/src/components/artist/artist-profile-card.tsx';
let content = readFileSync(file, 'utf-8');

// Find the section to replace: from "// Debounced auto-save for layout changes" to "// Guardar layout en la base de datos"
const startMarker = '  // Debounced auto-save for layout changes';
const endMarker = '  // Guardar layout en la base de datos';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Markers not found!', startIdx, endIdx);
  process.exit(1);
}

const replacement = `  // Debounced auto-save for layout changes
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveLayout = useCallback((newOrder: string[]) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(\`/api/profile/\${artistId}/layout\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order: newOrder,
            visibility: sectionVisibility,
            expanded: sectionExpanded
          })
        });
      } catch (e) {
        logger.error('Auto-save layout failed:', e);
      }
    }, 800);
  }, [artistId, sectionVisibility, sectionExpanded]);

  // Unified drag handler for both modal config and inline page drag
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;

    if (source.droppableId === 'inline-sections') {
      // Inline page drag
      const visibleIds = sectionOrder.filter(id => sectionVisibility[id]);
      const movedId = visibleIds[source.index];
      if (!movedId) return;
      const newOrder = sectionOrder.filter(id => id !== movedId);
      const destVisibleId = visibleIds[destination.index];
      const insertIdx = destVisibleId ? newOrder.indexOf(destVisibleId) : newOrder.length;
      if (source.index < destination.index) {
        newOrder.splice(insertIdx + 1, 0, movedId);
      } else {
        newOrder.splice(insertIdx, 0, movedId);
      }
      setSectionOrder(newOrder);
      autoSaveLayout(newOrder);
    } else {
      // Modal config drag
      const items = Array.from(sectionOrder);
      const [reorderedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reorderedItem);
      setSectionOrder(items);
      autoSaveLayout(items);
    }
  };

  // Move section up/down with arrow buttons (auto-saves)
  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    const idx = sectionOrder.indexOf(sectionId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sectionOrder.length) return;
    const items = [...sectionOrder];
    [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
    setSectionOrder(items);
    autoSaveLayout(items);
  };

  `;

content = content.substring(0, startIdx) + replacement + content.substring(endIdx);

writeFileSync(file, content, 'utf-8');
console.log('Done! Replaced', endIdx - startIdx, 'chars with', replacement.length, 'chars');
