import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface MobileEditorLayoutProps {
  previewComponent: React.ReactNode;
  timelineComponent: React.ReactNode;
  editComponent: React.ReactNode;
  children?: React.ReactNode;
}

export function MobileEditorLayout({ 
  previewComponent, 
  timelineComponent, 
  editComponent,
  children 
}: MobileEditorLayoutProps) {
  const [expandedSection, setExpandedSection] = useState<string>('preview');
  
  // Definir las secciones
  const sections = [
    { id: 'preview', title: 'Vista previa', content: previewComponent },
    { id: 'timeline', title: 'Línea de tiempo', content: timelineComponent },
    { id: 'edit', title: 'Editor', content: editComponent }
  ];
  
  return (
    <div className="flex flex-col w-full h-full bg-black overflow-auto">
      {/* Secciones colapsables */}
      {sections.map(section => (
        <div 
          key={section.id}
          id={`${section.id}-section`}
          className={`border border-zinc-800 rounded-md mb-2 transition-all duration-300 ${
            expandedSection === section.id 
              ? 'flex-1 min-h-[50vh]' 
              : 'min-h-[60px]'
          }`}
        >
          {/* Encabezado de la sección */}
          <div 
            className="flex items-center justify-between p-3 bg-zinc-900 cursor-pointer"
            onClick={() => setExpandedSection(section.id)}
          >
            <h3 className="font-medium text-white">{section.title}</h3>
            {expandedSection === section.id ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </div>
          
          {/* Contenido de la sección */}
          <div className={`transition-all duration-300 overflow-hidden ${
            expandedSection === section.id ? 'h-auto p-2' : 'h-0'
          }`}>
            {section.content}
          </div>
        </div>
      ))}
      
      {/* Contenido adicional */}
      {children}
    </div>
  );
}