import React from 'react';
import { logger } from "../../lib/logger";

interface PageHeaderProps {
  title: string;
  description?: string;
}

/**
 * Consistent page header with title and optional description
 */
export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-8 space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {description && (
        <p className="text-muted-foreground max-w-3xl">
          {description}
        </p>
      )}
    </div>
  );
}