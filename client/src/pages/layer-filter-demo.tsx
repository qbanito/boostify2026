import React from 'react';
import { LayerFilterDemo } from '../components/music-video/layer-filter-demo';

export default function LayerFilterDemoPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Demostración del Filtro de Capas</h1>
      <p className="mb-6 text-muted-foreground">
        Esta página demuestra la funcionalidad de filtrado de capas implementada en el editor de timeline.
        Puedes activar o desactivar diferentes capas para ver cómo afecta a la visibilidad de los clips.
      </p>
      
      <LayerFilterDemo />
    </div>
  );
}