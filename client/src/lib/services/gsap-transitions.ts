import gsap from 'gsap';

export type GSAPTransitionType = 
  | 'fade'
  | 'crossfade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'wipe-left'
  | 'wipe-right'
  | 'dissolve'
  | 'cut';

export interface GSAPTransitionConfig {
  type: GSAPTransitionType;
  duration: number;
  ease?: string;
  delay?: number;
}

export interface ImageEffects {
  blur?: number;
  brightness?: number;
  opacity?: number;
  shadow?: {
    x: number;
    y: number;
    blur: number;
    color: string;
  };
}

export interface GSAPSceneConfig {
  imageUrl: string;
  duration: number;
  transition?: GSAPTransitionConfig;
  cameraMovement?: 'pan-left' | 'pan-right' | 'zoom-in' | 'zoom-out' | 'static';
  movementIntensity?: number;
  effects?: ImageEffects;
}

/**
 * GSAP Transitions Service
 * Proporciona transiciones cinematográficas profesionales usando GSAP
 */
export class GSAPTransitionsService {
  private timeline: gsap.core.Timeline | null = null;
  private currentContainer: HTMLElement | null = null;

  /**
   * Aplica efectos CSS a un elemento basado en la configuración de efectos
   */
  private applyVisualEffects(element: HTMLElement, effects?: ImageEffects): void {
    if (!effects) return;

    const filters: string[] = [];
    
    if (effects.blur !== undefined && effects.blur > 0) {
      filters.push(`blur(${effects.blur}px)`);
    }
    
    if (effects.brightness !== undefined) {
      filters.push(`brightness(${effects.brightness}%)`);
    }
    
    if (filters.length > 0) {
      element.style.filter = filters.join(' ');
    }
    
    if (effects.opacity !== undefined) {
      element.style.opacity = String(effects.opacity / 100);
    }
    
    if (effects.shadow) {
      const { x, y, blur, color } = effects.shadow;
      if (x !== 0 || y !== 0 || blur !== 0) {
        element.style.boxShadow = `${x}px ${y}px ${blur}px ${color}`;
      }
    }
  }

  /**
   * Crea una timeline GSAP con todas las escenas y transiciones
   */
  createTimeline(
    container: HTMLElement,
    scenes: GSAPSceneConfig[],
    options?: {
      onComplete?: () => void;
      onUpdate?: (progress: number) => void;
      onSceneChange?: (sceneIndex: number) => void;
    }
  ): gsap.core.Timeline {
    this.currentContainer = container;
    
    // Crear timeline principal
    this.timeline = gsap.timeline({
      paused: true,
      onComplete: options?.onComplete,
      onUpdate: () => {
        if (options?.onUpdate && this.timeline) {
          options.onUpdate(this.timeline.progress());
        }
      }
    });

    let currentSceneIndex = 0;

    scenes.forEach((scene, index) => {
      // Crear elemento de imagen para esta escena
      const imageElement = document.createElement('div');
      imageElement.className = 'gsap-scene absolute inset-0 w-full h-full';
      imageElement.style.backgroundImage = `url(${scene.imageUrl})`;
      imageElement.style.backgroundSize = 'cover';
      imageElement.style.backgroundPosition = 'center';
      imageElement.style.opacity = '0';
      imageElement.setAttribute('data-scene-index', String(index));
      
      // Aplicar efectos visuales si están configurados
      this.applyVisualEffects(imageElement, scene.effects);
      
      container.appendChild(imageElement);

      // Aplicar entrada de escena
      this.addSceneEntry(imageElement, scene, index);

      // Aplicar movimiento de cámara durante la escena
      if (scene.cameraMovement && scene.cameraMovement !== 'static') {
        this.addCameraMovement(imageElement, scene);
      }

      // Aplicar transición de salida
      if (index < scenes.length - 1) {
        const nextScene = scenes[index + 1];
        this.addSceneTransition(imageElement, scene, nextScene);
      } else {
        // Última escena - simplemente mantenerla visible
        this.timeline!.to(imageElement, {
          duration: scene.duration,
          onStart: () => {
            if (options?.onSceneChange) {
              options.onSceneChange(index);
            }
          }
        });
      }
    });

    return this.timeline;
  }

  /**
   * Agrega la entrada inicial de una escena
   */
  private addSceneEntry(
    element: HTMLElement,
    scene: GSAPSceneConfig,
    index: number
  ): void {
    const transition = scene.transition || { type: 'fade', duration: 0.5 };
    
    switch (transition.type) {
      case 'fade':
      case 'crossfade':
      case 'dissolve':
        this.timeline!.to(element, {
          opacity: 1,
          duration: transition.duration,
          ease: transition.ease || 'power2.inOut'
        }, index === 0 ? 0 : undefined);
        break;

      case 'slide-left':
        gsap.set(element, { opacity: 1, x: '100%' });
        this.timeline!.to(element, {
          x: '0%',
          duration: transition.duration,
          ease: transition.ease || 'power3.out'
        });
        break;

      case 'slide-right':
        gsap.set(element, { opacity: 1, x: '-100%' });
        this.timeline!.to(element, {
          x: '0%',
          duration: transition.duration,
          ease: transition.ease || 'power3.out'
        });
        break;

      case 'slide-up':
        gsap.set(element, { opacity: 1, y: '100%' });
        this.timeline!.to(element, {
          y: '0%',
          duration: transition.duration,
          ease: transition.ease || 'power3.out'
        });
        break;

      case 'slide-down':
        gsap.set(element, { opacity: 1, y: '-100%' });
        this.timeline!.to(element, {
          y: '0%',
          duration: transition.duration,
          ease: transition.ease || 'power3.out'
        });
        break;

      case 'zoom-in':
        gsap.set(element, { opacity: 1, scale: 0.5 });
        this.timeline!.to(element, {
          scale: 1,
          duration: transition.duration,
          ease: transition.ease || 'power2.out'
        });
        break;

      case 'zoom-out':
        gsap.set(element, { opacity: 1, scale: 1.5 });
        this.timeline!.to(element, {
          scale: 1,
          duration: transition.duration,
          ease: transition.ease || 'power2.out'
        });
        break;

      case 'cut':
        gsap.set(element, { opacity: 1 });
        break;

      default:
        gsap.set(element, { opacity: 1 });
    }
  }

  /**
   * Agrega movimiento de cámara durante una escena
   */
  private addCameraMovement(
    element: HTMLElement,
    scene: GSAPSceneConfig
  ): void {
    const intensity = scene.movementIntensity || 0.1;
    const duration = scene.duration;

    switch (scene.cameraMovement) {
      case 'pan-left':
        this.timeline!.to(element, {
          x: `-${intensity * 100}%`,
          duration: duration,
          ease: 'none'
        }, '<'); // '<' significa que empieza al mismo tiempo que la animación anterior
        break;

      case 'pan-right':
        this.timeline!.to(element, {
          x: `${intensity * 100}%`,
          duration: duration,
          ease: 'none'
        }, '<');
        break;

      case 'zoom-in':
        this.timeline!.to(element, {
          scale: 1 + intensity,
          duration: duration,
          ease: 'none'
        }, '<');
        break;

      case 'zoom-out':
        gsap.set(element, { scale: 1 + intensity });
        this.timeline!.to(element, {
          scale: 1,
          duration: duration,
          ease: 'none'
        }, '<');
        break;
    }
  }

  /**
   * Agrega transición entre dos escenas
   */
  private addSceneTransition(
    currentElement: HTMLElement,
    currentScene: GSAPSceneConfig,
    nextScene: GSAPSceneConfig
  ): void {
    const transition = nextScene.transition || { type: 'fade', duration: 0.5 };

    // Mantener la escena actual visible por su duración
    this.timeline!.to(currentElement, {
      duration: currentScene.duration
    });

    // Aplicar transición de salida
    switch (transition.type) {
      case 'crossfade':
      case 'dissolve':
        // Crossfade: La siguiente escena ya se encarga de hacer fade in
        this.timeline!.to(currentElement, {
          opacity: 0,
          duration: transition.duration,
          ease: transition.ease || 'power2.inOut'
        }, `>-${transition.duration}`); // Se solapa con la entrada de la siguiente
        break;

      case 'fade':
        this.timeline!.to(currentElement, {
          opacity: 0,
          duration: transition.duration,
          ease: transition.ease || 'power2.inOut'
        });
        break;

      case 'slide-left':
        this.timeline!.to(currentElement, {
          x: '-100%',
          duration: transition.duration,
          ease: transition.ease || 'power3.in'
        });
        break;

      case 'slide-right':
        this.timeline!.to(currentElement, {
          x: '100%',
          duration: transition.duration,
          ease: transition.ease || 'power3.in'
        });
        break;

      case 'slide-up':
        this.timeline!.to(currentElement, {
          y: '-100%',
          duration: transition.duration,
          ease: transition.ease || 'power3.in'
        });
        break;

      case 'slide-down':
        this.timeline!.to(currentElement, {
          y: '100%',
          duration: transition.duration,
          ease: transition.ease || 'power3.in'
        });
        break;

      case 'zoom-in':
        this.timeline!.to(currentElement, {
          scale: 1.5,
          opacity: 0,
          duration: transition.duration,
          ease: transition.ease || 'power2.in'
        });
        break;

      case 'zoom-out':
        this.timeline!.to(currentElement, {
          scale: 0.5,
          opacity: 0,
          duration: transition.duration,
          ease: transition.ease || 'power2.in'
        });
        break;

      case 'cut':
        this.timeline!.to(currentElement, {
          opacity: 0,
          duration: 0
        });
        break;

      default:
        this.timeline!.to(currentElement, {
          opacity: 0,
          duration: transition.duration || 0.5
        });
    }
  }

  /**
   * Controles de reproducción
   */
  play(): void {
    this.timeline?.play();
  }

  pause(): void {
    this.timeline?.pause();
  }

  restart(): void {
    this.timeline?.restart();
  }

  seek(progress: number): void {
    if (this.timeline) {
      this.timeline.progress(progress);
    }
  }

  seekTime(time: number): void {
    this.timeline?.seek(time);
  }

  getTotalDuration(): number {
    return this.timeline?.duration() || 0;
  }

  getCurrentTime(): number {
    return this.timeline?.time() || 0;
  }

  getProgress(): number {
    return this.timeline?.progress() || 0;
  }

  destroy(): void {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }
    if (this.currentContainer) {
      // Limpiar todos los elementos de escena
      const scenes = this.currentContainer.querySelectorAll('.gsap-scene');
      scenes.forEach(scene => scene.remove());
      this.currentContainer = null;
    }
  }
}

export const gsapTransitionsService = new GSAPTransitionsService();
