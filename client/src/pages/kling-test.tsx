import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { SimpleTryOnComponent } from '../components/kling/simple-tryon-improved';

export default function KlingTestPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Pruebas de Kling API</h1>
      
      <Tabs defaultValue="simple-tryon" className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-3">
          <TabsTrigger value="simple-tryon">Prueba Virtual Simple</TabsTrigger>
          <TabsTrigger value="advanced" disabled>Prueba Virtual Avanzada</TabsTrigger>
          <TabsTrigger value="api-test" disabled>Tests de API</TabsTrigger>
        </TabsList>
        
        <TabsContent value="simple-tryon" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Prueba Virtual Simple</CardTitle>
              <CardDescription>
                Sube una foto de modelo y ropa para probar la funcionalidad de Try-On de Kling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4 bg-amber-50 border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-700">Prueba de integración API</AlertTitle>
                <AlertDescription className="text-amber-600">
                  Esta es una versión simplificada del componente de Try-On con las mejoras para procesamiento de imágenes.
                </AlertDescription>
              </Alert>
              
              <SimpleTryOnComponent />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle>Prueba Virtual Avanzada</CardTitle>
              <CardDescription>
                Prueba avanzada con más opciones y configuraciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Funcionalidad pendiente de implementación</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="api-test">
          <Card>
            <CardHeader>
              <CardTitle>Tests de API</CardTitle>
              <CardDescription>
                Pruebas directas a endpoints de la API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Funcionalidad pendiente de implementación</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}