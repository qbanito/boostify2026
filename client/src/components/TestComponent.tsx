import React from 'react';

export function TestComponent() {
  return (
    <div className="p-8 bg-background rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4">Componente de prueba para verificar enrutamiento</h1>
      <p className="mb-4">
        Este componente se creó para verificar que el enrutamiento básico funciona correctamente.
      </p>
      <div className="p-4 bg-accent rounded-md">
        <h2 className="font-medium mb-2">Estado del sistema:</h2>
        <ul className="list-disc pl-4 space-y-1">
          <li>Servidor Express: Activo</li>
          <li>Cliente React: Activo</li>
          <li>Desarrollo Vite: Activo</li>
        </ul>
      </div>
    </div>
  );
}