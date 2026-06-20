/**
 * Servicio para gestionar el flujo de trabajo del asesor de imagen de artistas
 * 
 * Este servicio centraliza el estado y la lógica de los diferentes pasos del proceso
 * de asesoría de imagen, manteniendo datos consistentes entre componentes.
 */

import { create } from 'zustand';

// Definición de tipos para el workflow
export type WorkflowStep = 'upload' | 'style' | 'virtual-tryon' | 'generate' | 'results';

export interface ArtistStyle {
  genre?: string;
  vibe?: string;
  aesthetic?: string;
  colorPalette?: string;
}

export interface TryOnData {
  modelImage?: string | null;
  clothingImage?: string | null;
  taskId?: string | null;
  resultImage?: string | null;
}

// Interfaz para el estado del workflow
export interface WorkflowState {
  // Estado actual del workflow
  currentStep: WorkflowStep;
  setCurrentStep: (step: WorkflowStep) => void;
  
  // Imagen de referencia (paso 1)
  referenceImage: string | null;
  setReferenceImage: (image: string | null) => void;
  
  // Estilo artístico (paso 2)
  artistStyle: ArtistStyle;
  updateArtistStyle: (style: Partial<ArtistStyle>) => void;
  
  // Imágenes de estilo generadas (ejemplos)
  styleImages: string[];
  addStyleImage: (image: string) => void;
  clearStyleImages: () => void;
  
  // Datos de Try-On (paso 3)
  tryOnResults: TryOnData;
  updateTryOnData: (data: Partial<TryOnData>) => void;
  
  // Imágenes generadas finales (paso 4 y 5)
  generatedImages: string[];
  addGeneratedImage: (image: string) => void;
  clearGeneratedImages: () => void;
  
  // Función para reiniciar todo el estado
  resetWorkflow: () => void;
}

// Orden de los pasos del workflow
const workflowSteps: WorkflowStep[] = ['upload', 'style', 'virtual-tryon', 'generate', 'results'];

// Helper para obtener el siguiente paso
export function getNextStep(currentStep: WorkflowStep): WorkflowStep {
  const currentIndex = workflowSteps.indexOf(currentStep);
  if (currentIndex < 0 || currentIndex >= workflowSteps.length - 1) {
    return currentStep; // Si es el último paso o no se encuentra, se mantiene
  }
  return workflowSteps[currentIndex + 1];
}

// Helper para obtener el paso anterior
export function getPreviousStep(currentStep: WorkflowStep): WorkflowStep {
  const currentIndex = workflowSteps.indexOf(currentStep);
  if (currentIndex <= 0) {
    return currentStep; // Si es el primer paso o no se encuentra, se mantiene
  }
  return workflowSteps[currentIndex - 1];
}

// Creación del store con Zustand
export const useArtistImageWorkflow = create<WorkflowState>((set) => ({
  // Estado inicial
  currentStep: 'upload',
  referenceImage: null,
  artistStyle: {},
  styleImages: [],
  tryOnResults: {},
  generatedImages: [],
  
  // Setters para cada parte del estado
  setCurrentStep: (step) => set({ currentStep: step }),
  
  setReferenceImage: (image) => set({ referenceImage: image }),
  
  updateArtistStyle: (style) => set((state) => ({
    artistStyle: { ...state.artistStyle, ...style }
  })),
  
  addStyleImage: (image) => set((state) => ({
    styleImages: [...state.styleImages, image]
  })),
  
  clearStyleImages: () => set({ styleImages: [] }),
  
  updateTryOnData: (data) => set((state) => ({
    tryOnResults: { ...state.tryOnResults, ...data }
  })),
  
  addGeneratedImage: (image) => set((state) => ({
    generatedImages: [...state.generatedImages, image]
  })),
  
  clearGeneratedImages: () => set({ generatedImages: [] }),
  
  // Reiniciar todo el estado
  resetWorkflow: () => set({
    currentStep: 'upload',
    referenceImage: null,
    artistStyle: {},
    styleImages: [],
    tryOnResults: {},
    generatedImages: []
  })
}));