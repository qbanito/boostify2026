import React from "react";
import { SectionNavigation, SimpleSectionNavigation } from "../navigation/section-navigation";

interface NavigationWrapperProps {
  activeSection: 'music' | 'videos' | 'merch' | 'shows';
  onSectionChange: (section: 'music' | 'videos' | 'merch' | 'shows') => void;
  onShare?: () => void;
  onMessage?: () => void;
}

/**
 * Componente wrapper para la navegación principal (con acciones)
 */
export const NavigationHeader: React.FC<NavigationWrapperProps> = ({
  activeSection,
  onSectionChange,
  onShare,
  onMessage,
}) => {
  return (
    <SectionNavigation 
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      onShare={onShare}
      onMessage={onMessage}
      showActions={true}
    />
  );
};

/**
 * Componente wrapper para la navegación simple (sin acciones)
 */
export const SimpleNavigationHeader: React.FC<NavigationWrapperProps> = ({
  activeSection,
  onSectionChange,
}) => {
  return (
    <SimpleSectionNavigation 
      activeSection={activeSection}
      onSectionChange={onSectionChange}
    />
  );
};