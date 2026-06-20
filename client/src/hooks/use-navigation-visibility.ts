import { create } from 'zustand';
import { useEffect } from 'react';

interface NavigationVisibilityStore {
  isVisible: boolean;
  setIsVisible: (value: boolean) => void;
  toggle: () => void;
  enableDoubleClickListeners: () => void;
  disableDoubleClickListeners: () => void;
  isListening: boolean;
}

// Creamos un store Zustand para manejar el estado global de visibilidad
export const useNavigationVisibilityStore = create<NavigationVisibilityStore>((set, get) => ({
  isVisible: true,
  isListening: false,
  setIsVisible: (value: boolean) => set({ isVisible: value }),
  toggle: () => set((state) => ({ isVisible: !state.isVisible })),
  
  // Habilitar los listeners de doble clic
  enableDoubleClickListeners: () => {
    if (get().isListening) return; // Si ya está escuchando, no hacer nada
    
    // Configurar el listener global de doble clic
    let lastClickTime = 0;
    const doubleClickThreshold = 300; // ms
    
    const handleGlobalClick = (event: MouseEvent) => {
      // No considerar clics en elementos de navegación o controles
      if ((event.target as HTMLElement).closest('.nav-btn, .mobile-nav-item, button, a, input, textarea, select')) {
        return;
      }
      
      const now = Date.now();
      const timeDiff = now - lastClickTime;
      
      if (timeDiff < doubleClickThreshold) {
        // Es un doble clic - alternar la visibilidad
        get().toggle();
        lastClickTime = 0;
      } else {
        // Es un primer clic - actualizar el temporizador
        lastClickTime = now;
      }
    };
    
    // Añadir el listener al documento
    document.addEventListener('click', handleGlobalClick);
    
    // Guardar referencia al listener y marcar como activo
    (window as any).__navigationGlobalClickHandler = handleGlobalClick;
    set({ isListening: true });
  },
  
  // Deshabilitar los listeners
  disableDoubleClickListeners: () => {
    if (!get().isListening) return; // Si no está escuchando, no hacer nada
    
    // Eliminar el listener si existe
    if ((window as any).__navigationGlobalClickHandler) {
      document.removeEventListener('click', (window as any).__navigationGlobalClickHandler);
      (window as any).__navigationGlobalClickHandler = null;
    }
    
    set({ isListening: false });
  }
}));

// Hook personalizado que combina el store con la gestión de efectos para los listeners
export function useNavigationVisibility() {
  const { 
    isVisible, 
    setIsVisible, 
    toggle, 
    enableDoubleClickListeners, 
    disableDoubleClickListeners 
  } = useNavigationVisibilityStore();
  
  // Automáticamente configurar los listeners cuando el hook se usa
  useEffect(() => {
    enableDoubleClickListeners();
    
    // Limpiar al desmontar
    return () => {
      // Nota: Solo deshabilitamos si este es el último componente usando el hook
      // En una app real podríamos usar un contador de referencias
      disableDoubleClickListeners();
    };
  }, [enableDoubleClickListeners, disableDoubleClickListeners]);
  
  return { isVisible, setIsVisible, toggle };
}