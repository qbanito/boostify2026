/**
 * Componente de encabezado de página
 * 
 * Proporciona un formato consistente para los encabezados de página en toda la aplicación
 * con título, descripción opcional y acciones opcionales.
 */

import React, { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex-shrink-0 mt-4 md:mt-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export default PageHeader;