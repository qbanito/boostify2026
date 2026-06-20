/**
import { logger } from "@/lib/logger";
 * Componente de Clonación Profesional de Voz
 * 
 * Este componente proporciona una interfaz de usuario avanzada para:
 * 1. Crear modelos de voz personalizados usando Revocalize
 * 2. Convertir audio entre diferentes voces
 * 3. Aplicar efectos profesionales usando KITS AI
 * 4. Visualizar y compartir el historial de conversiones
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle 
} from '../ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  Mic, Upload, Wand2, Music2, BarChart3, History, 
  Settings, Plus, Server, Info, HelpCircle 
} from 'lucide-react';
import { VoiceConversionStudio } from './VoiceConversionStudio';
import { VoiceModelCreator } from './voice-model-creator';
import { voiceModelService } from '../../lib/services/voice-model-service';
import { toast } from '../../hooks/use-toast';

interface ProfessionalVoiceModelingProps {
  className?: string;
}

export function ProfessionalVoiceCloning({ className }: ProfessionalVoiceModelingProps) {
  const [activeTab, setActiveTab] = useState<string>('studio');
  
  // Verificar el estado de las APIs
  const { data: apiStatus, isLoading: isLoadingApiStatus } = useQuery({
    queryKey: ['api-status'],
    queryFn: async () => {
      // Verificar si las claves API están configuradas
      const isConfigured = voiceModelService.isApiKeyConfigured();
      
      // Obtener los modelos disponibles para comprobar la conexión
      try {
        const models = await voiceModelService.getAvailableModels();
        return { 
          isConfigured, 
          isConnected: true, 
          modelsCount: models.length 
        };
      } catch (error) {
        logger.error('Error verificando estado de API:', error);
        return { 
          isConfigured, 
          isConnected: false, 
          error: error instanceof Error ? error.message : 'Error desconocido'
        };
      }
    },
    refetchOnWindowFocus: false
  });
  
  return (
    <div className={className}>
      <Card className="w-full shadow-md shadow-blue-500/5">
        <CardHeader className="bg-blue-500/5 px-3 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl md:text-2xl">
                <Mic className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                Voice AI Studio
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Plataforma profesional de clonación y procesamiento de voz con IA
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              {apiStatus ? (
                apiStatus.isConfigured ? (
                  <div className="text-[10px] sm:text-xs bg-green-500/10 text-green-600 py-1 px-2 rounded-md flex items-center gap-1 w-full sm:w-auto">
                    <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-green-500"></div>
                    <span className="whitespace-nowrap">APIs conectadas ({apiStatus.modelsCount || 0})</span>
                  </div>
                ) : (
                  <div className="text-[10px] sm:text-xs bg-amber-500/10 text-amber-600 py-1 px-2 rounded-md flex items-center gap-1 w-full sm:w-auto">
                    <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-amber-500"></div>
                    <span className="whitespace-nowrap">API keys no configuradas</span>
                  </div>
                )
              ) : isLoadingApiStatus ? (
                <div className="text-[10px] sm:text-xs bg-blue-500/10 text-blue-600 py-1 px-2 rounded-md flex items-center gap-1 w-full sm:w-auto">
                  <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-blue-500 animate-pulse"></div>
                  <span className="whitespace-nowrap">Verificando APIs...</span>
                </div>
              ) : (
                <div className="text-[10px] sm:text-xs bg-red-500/10 text-red-600 py-1 px-2 rounded-md flex items-center gap-1 w-full sm:w-auto">
                  <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-red-500"></div>
                  <span className="whitespace-nowrap">Error de conexión</span>
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm"
                className="text-[10px] sm:text-xs px-2 py-1 h-auto sm:h-8"
                onClick={() => {
                  toast({
                    title: 'Sobre las APIs de voz',
                    description: 'Este componente integra Revocalize para clonación de voz y KITS AI para efectos profesionales de audio.',
                  });
                }}
              >
                <Info className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Info
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
          <Tabs defaultValue="studio" onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 mb-4 sm:mb-6 md:mb-8 gap-1">
              <TabsTrigger value="studio" className="flex items-center gap-1 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs">
                <Music2 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="whitespace-nowrap">Estudio de <span className="hidden sm:inline">Voz</span></span>
              </TabsTrigger>
              <TabsTrigger value="models" className="flex items-center gap-1 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs">
                <Wand2 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="whitespace-nowrap"><span className="hidden sm:inline">Creación de</span> Modelos</span>
              </TabsTrigger>
              <TabsTrigger value="config" className="flex items-center gap-1 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs">
                <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="whitespace-nowrap">Config<span className="hidden sm:inline">uración</span></span>
              </TabsTrigger>
            </TabsList>
            
            {/* Estudio de conversión de voz */}
            <TabsContent value="studio" className="space-y-4">
              <VoiceConversionStudio />
            </TabsContent>
            
            {/* Creación de modelos de voz */}
            <TabsContent value="models" className="space-y-4">
              <VoiceModelCreator />
            </TabsContent>
            
            {/* Configuración y ajustes */}
            <TabsContent value="config" className="space-y-4">
              <div className="bg-blue-500/5 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6">
                <h2 className="text-base sm:text-lg md:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-1 sm:gap-2">
                  <Server className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                  Configuración de APIs
                </h2>
                
                <div className="space-y-4 sm:space-y-6">
                  {/* Configuración de Revocalize */}
                  <div>
                    <h3 className="text-sm sm:text-base font-medium mb-1 sm:mb-2">Revocalize API</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-4">
                      Esta API se utiliza para crear modelos personalizados de voz y realizar conversiones de voz.
                    </p>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                      <Input
                        type="password"
                        placeholder="Ingresa tu API key de Revocalize"
                        className="w-full sm:max-w-md text-xs sm:text-sm h-8 sm:h-10"
                      />
                      <Button variant="secondary" size="sm" className="text-xs h-8 w-full sm:w-auto">
                        Guardar
                      </Button>
                    </div>
                  </div>
                  
                  {/* Configuración de KITS */}
                  <div>
                    <h3 className="text-sm sm:text-base font-medium mb-1 sm:mb-2">KITS Audio API</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-4">
                      Esta API proporciona efectos avanzados de audio y post-procesamiento.
                    </p>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                      <Input
                        type="password"
                        placeholder="Ingresa tu API key de KITS Audio"
                        className="w-full sm:max-w-md text-xs sm:text-sm h-8 sm:h-10"
                      />
                      <Button variant="secondary" size="sm" className="text-xs h-8 w-full sm:w-auto">
                        Guardar
                      </Button>
                    </div>
                  </div>
                  
                  {/* Opciones avanzadas */}
                  <div className="pt-3 sm:pt-4 border-t">
                    <h3 className="text-sm sm:text-base font-medium mb-1 sm:mb-2">Opciones Avanzadas</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-4">
                      Configura opciones avanzadas para el procesamiento de voz y modelos.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                      <Button variant="outline" size="sm" className="justify-start text-xs h-8 sm:h-9">
                        <HelpCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Documentación de APIs
                      </Button>
                      <Button variant="outline" size="sm" className="justify-start text-xs h-8 sm:h-9">
                        <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Ver uso de la API
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="bg-blue-500/5 flex flex-col sm:flex-row justify-center sm:justify-between items-center px-3 py-3 sm:px-6 sm:py-4 gap-2">
          <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            Integración con Revocalize y KITS AI
          </div>
          <div>
            <Button variant="link" size="sm" className="text-[10px] sm:text-xs text-muted-foreground px-2 h-6 sm:h-8">
              Términos de uso
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}