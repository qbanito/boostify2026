import { useState, useEffect } from 'react';

/**
 * Hook personalizado para detectar si la ventana actual corresponde a un tamaño de dispositivo móvil
 * @param breakpoint Punto de quiebre en píxeles (por defecto 768px)
 * @returns Boolean indicando si el dispositivo es móvil
 */
export function useIsMobile(breakpoint: number = 768) {
  // Estado para almacenar si es móvil o no
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  useEffect(() => {
    // Función para verificar el tamaño de la ventana
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };
    
    // Verificar inicialmente
    checkMobile();
    
    // Agregar listener para cambios de tamaño
    window.addEventListener('resize', checkMobile);
    
    // Limpiar el listener cuando el componente se desmonte
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [breakpoint]);
  
  return isMobile;
}

/**
 * Hook para obtener las dimensiones actuales de la ventana
 * @returns Objeto con el ancho y alto de la ventana
 */
export function useWindowSize() {
  // Estado para almacenar las dimensiones
  const [windowSize, setWindowSize] = useState<{
    width: number | undefined;
    height: number | undefined;
  }>({
    width: undefined,
    height: undefined,
  });
  
  useEffect(() => {
    // Función para actualizar el estado con las dimensiones actuales
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    
    // Evento para escuchar los cambios de tamaño
    window.addEventListener('resize', handleResize);
    
    // Llamada inicial para establecer el estado inicial
    handleResize();
    
    // Limpiar el evento cuando el componente se desmonte
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return windowSize;
}

/**
 * Hook para detectar gestos táctiles básicos
 * @returns Objeto con funciones y estados para manejar gestos táctiles
 */
export function useTouchGestures() {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Distancia mínima requerida entre touchStart y touchEnd para ser considerado como swipe
  const minSwipeDistance = 50;
  
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      // console.log('Swipe left detected');
      return 'left';
    }
    
    if (isRightSwipe) {
      // console.log('Swipe right detected');
      return 'right';
    }
    
    return null;
  };
  
  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    touchStart,
    touchEnd
  };
}