import React from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Music2, Video as VideoIcon, Ticket, ShoppingBag, Share2, MessageCircle } from "lucide-react";

interface SectionNavigationProps {
  activeSection: 'music' | 'videos' | 'merch' | 'shows';
  onSectionChange: (section: 'music' | 'videos' | 'merch' | 'shows') => void;
  onShare?: () => void;
  onMessage?: () => void;
  showActions?: boolean;
}

export const SectionNavigation: React.FC<SectionNavigationProps> = ({
  activeSection,
  onSectionChange,
  onShare,
  onMessage,
  showActions = false
}) => {
  return (
    <Card className="p-3 bg-black/60 backdrop-blur-md border-orange-500/20 sticky top-4 z-30 mb-6 max-h-60">
      <div className="flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-orange-500">Secciones</h3>
          {showActions && (
            <div className="flex gap-1">
              {onShare && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full hover:bg-orange-500/10 text-orange-500"
                  onClick={onShare}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              )}
              
              {onMessage && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full hover:bg-orange-500/10 text-orange-500"
                  onClick={onMessage}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col overflow-y-auto overflow-x-hidden gap-2 pr-1 custom-scrollbar">
          <Button 
            size="sm" 
            variant={activeSection === 'music' ? 'default' : 'outline'}
            className={`rounded-full transition-all duration-300 ${
              activeSection === 'music' 
                ? 'bg-orange-500 text-white hover:bg-orange-600' 
                : 'text-orange-500 border-orange-500/30 hover:bg-orange-500/10'
            }`}
            onClick={() => onSectionChange('music')}
          >
            <Music2 className="mr-2 h-4 w-4" />
            Música
          </Button>
          <Button 
            size="sm" 
            variant={activeSection === 'videos' ? 'default' : 'outline'}
            className={`rounded-full transition-all duration-300 ${
              activeSection === 'videos' 
                ? 'bg-orange-500 text-white hover:bg-orange-600' 
                : 'text-orange-500 border-orange-500/30 hover:bg-orange-500/10'
            }`}
            onClick={() => onSectionChange('videos')}
          >
            <VideoIcon className="mr-2 h-4 w-4" />
            Videos
          </Button>
          <Button 
            size="sm" 
            variant={activeSection === 'shows' ? 'default' : 'outline'}
            className={`rounded-full transition-all duration-300 ${
              activeSection === 'shows' 
                ? 'bg-orange-500 text-white hover:bg-orange-600' 
                : 'text-orange-500 border-orange-500/30 hover:bg-orange-500/10'
            }`}
            onClick={() => onSectionChange('shows')}
          >
            <Ticket className="mr-2 h-4 w-4" />
            Shows
          </Button>
          <Button 
            size="sm" 
            variant={activeSection === 'merch' ? 'default' : 'outline'}
            className={`rounded-full transition-all duration-300 ${
              activeSection === 'merch' 
                ? 'bg-orange-500 text-white hover:bg-orange-600' 
                : 'text-orange-500 border-orange-500/30 hover:bg-orange-500/10'
            }`}
            onClick={() => onSectionChange('merch')}
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            Merch
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default SectionNavigation;

// También exportamos una versión simplificada para usar en contextos más simples
export const SimpleSectionNavigation: React.FC<SectionNavigationProps> = ({
  activeSection,
  onSectionChange
}) => {
  return (
    <div className="flex justify-center my-6 overflow-x-auto">
      <div className="inline-flex items-center bg-black/50 backdrop-blur-sm rounded-full p-1 border border-orange-500/30">
        {[
          { id: 'music', label: 'Music', icon: <Music2 className="w-4 h-4 mr-2" /> },
          { id: 'videos', label: 'Videos', icon: <VideoIcon className="w-4 h-4 mr-2" /> },
          { id: 'shows', label: 'Shows', icon: <Ticket className="w-4 h-4 mr-2" /> },
          { id: 'merch', label: 'Merch', icon: <ShoppingBag className="w-4 h-4 mr-2" /> }
        ].map((section) => (
          <Button
            key={section.id}
            variant={activeSection === section.id ? "default" : "ghost"}
            size="sm"
            className={`rounded-full transition-all duration-300 ${
              activeSection === section.id
                ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onSectionChange(section.id as 'music' | 'videos' | 'merch' | 'shows')}
          >
            {section.icon}
            {section.label}
          </Button>
        ))}
      </div>
    </div>
  );
};