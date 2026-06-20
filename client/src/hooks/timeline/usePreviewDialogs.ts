import { useState } from 'react';
import { TimelineClip } from '../../components/music-video/timeline-editor';

interface UsePreviewDialogsResult {
  selectedImagePreview: TimelineClip | null;
  setSelectedImagePreview: React.Dispatch<React.SetStateAction<TimelineClip | null>>;
  expandedPreview: boolean;
  setExpandedPreview: React.Dispatch<React.SetStateAction<boolean>>;
  handleOpenPreview: (clip: TimelineClip) => void;
  handleClosePreview: () => void;
  handleToggleExpandPreview: () => void;
}

/**
 * Hook para gestionar diálogos de previsualización de imágenes y clips
 */
export function usePreviewDialogs(): UsePreviewDialogsResult {
  const [selectedImagePreview, setSelectedImagePreview] = useState<TimelineClip | null>(null);
  const [expandedPreview, setExpandedPreview] = useState<boolean>(false);
  
  // Handlers para el diálogo de previsualización
  const handleOpenPreview = (clip: TimelineClip) => {
    setSelectedImagePreview(clip);
  };
  
  const handleClosePreview = () => {
    setSelectedImagePreview(null);
    setExpandedPreview(false);
  };
  
  const handleToggleExpandPreview = () => {
    setExpandedPreview(prev => !prev);
  };
  
  return {
    selectedImagePreview,
    setSelectedImagePreview,
    expandedPreview,
    setExpandedPreview,
    handleOpenPreview,
    handleClosePreview,
    handleToggleExpandPreview
  };
}