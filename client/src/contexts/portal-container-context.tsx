import { createContext, useContext } from 'react';

/**
 * Context to provide a custom portal container for modals/tooltips.
 * When a fullscreen container is active, modals must render INSIDE it
 * (not on document.body) to avoid stacking context issues.
 *
 * Default: null (Radix uses document.body)
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext);
}
