import { useState } from "react";
import { 
  Card, 
  CardContent,
  CardDescription,
  CardFooter
} from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/tabs";
import { ScrollArea } from "../../ui/scroll-area";
import { 
  Music, 
  Check 
} from "lucide-react";
import { MusicGenreTemplate } from "./genre-data";

interface GenreTemplateSelectorProps {
  templates: MusicGenreTemplate[];
  selectedTemplate: string;
  onTemplateSelect: (templateId: string) => void;
}

/**
 * Componente que muestra y permite seleccionar plantillas de géneros musicales
 */
export function GenreTemplateSelector({
  templates,
  selectedTemplate,
  onTemplateSelect
}: GenreTemplateSelectorProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Agrupar las plantillas por categorías generales
  const categorizedTemplates = {
    popular: templates.filter(t => ["pop", "urban", "rock", "latin"].includes(t.id)),
    electronic: templates.filter(t => ["electronic", "lofi", "ambient"].includes(t.id)),
    acoustic: templates.filter(t => ["indie", "jazz", "classical"].includes(t.id)),
    other: templates.filter(t => !["pop", "urban", "rock", "latin", "electronic", "lofi", "ambient", "indie", "jazz", "classical"].includes(t.id))
  };
  
  // Renderizar plantilla individual (vista de grid)
  const renderTemplateCard = (template: MusicGenreTemplate) => {
    const isSelected = selectedTemplate === template.id;
    return (
      <Card 
        key={template.id}
        className={`cursor-pointer transition-all ${isSelected 
          ? 'border-primary ring-1 ring-primary/20 shadow-md' 
          : 'hover:border-primary/30 hover:shadow-sm'}`}
        onClick={() => onTemplateSelect(template.id)}
      >
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <Music className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
              <h3 className="font-medium">{template.name}</h3>
            </div>
            {isSelected && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                <Check className="h-3 w-3 mr-1" />
                Seleccionado
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{template.description}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {template.suggestedTags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {template.suggestedTags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{template.suggestedTags.length - 3}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };
  
  // Renderizar plantilla individual (vista de lista)
  const renderTemplateRow = (template: MusicGenreTemplate) => {
    const isSelected = selectedTemplate === template.id;
    return (
      <div 
        key={template.id}
        className={`flex items-center p-3 rounded-md cursor-pointer transition-all ${
          isSelected 
            ? 'bg-primary/10 border-primary/30' 
            : 'hover:bg-accent'
        }`}
        onClick={() => onTemplateSelect(template.id)}
      >
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <Music className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={`font-medium ${isSelected ? 'text-primary' : ''}`}>{template.name}</span>
            {isSelected && (
              <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/30">
                <Check className="h-3 w-3 mr-1" />
                Seleccionado
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground ml-6 mt-0.5">{template.description}</p>
        </div>
        <div className="flex gap-1">
          {template.suggestedTags.slice(0, 2).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Tabs defaultValue="popular" className="w-full">
          <div className="flex justify-between items-center mb-2">
            <TabsList>
              <TabsTrigger value="popular">Populares</TabsTrigger>
              <TabsTrigger value="electronic">Electrónica</TabsTrigger>
              <TabsTrigger value="acoustic">Acústica</TabsTrigger>
              <TabsTrigger value="all">Todos</TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-1">
              <Button 
                variant={viewMode === "grid" ? "secondary" : "ghost"} 
                size="sm"
                onClick={() => setViewMode("grid")}
                className="px-2.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </Button>
              <Button 
                variant={viewMode === "list" ? "secondary" : "ghost"} 
                size="sm"
                onClick={() => setViewMode("list")}
                className="px-2.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            </div>
          </div>
          
          <TabsContent value="popular">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categorizedTemplates.popular.map(renderTemplateCard)}
              </div>
            ) : (
              <div className="space-y-1 border rounded-md">
                {categorizedTemplates.popular.map(renderTemplateRow)}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="electronic">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categorizedTemplates.electronic.map(renderTemplateCard)}
              </div>
            ) : (
              <div className="space-y-1 border rounded-md">
                {categorizedTemplates.electronic.map(renderTemplateRow)}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="acoustic">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categorizedTemplates.acoustic.map(renderTemplateCard)}
              </div>
            ) : (
              <div className="space-y-1 border rounded-md">
                {categorizedTemplates.acoustic.map(renderTemplateRow)}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="all">
            <ScrollArea className="h-[320px] pr-3">
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {templates.map(renderTemplateCard)}
                </div>
              ) : (
                <div className="space-y-1 border rounded-md">
                  {templates.map(renderTemplateRow)}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}