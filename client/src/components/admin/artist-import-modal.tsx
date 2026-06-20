import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Upload, Download, CheckCircle2, XCircle, AlertCircle, Loader } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ImportResult {
  success: boolean;
  imported: number;
  errors: number;
  artists: any[];
  failedArtists: any[];
  message: string;
}

export function ArtistImportModal({ open, onOpenChange, onSuccess }: ImportModalProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'result' | 'complete'>('upload');

  const resetState = () => {
    setCsvFile(null);
    setResult(null);
    setStep('upload');
    setLoading(false);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona un archivo CSV válido',
        variant: 'destructive'
      });
      return;
    }
    setCsvFile(selectedFile);
    setResult(null);
  };

  const handleImport = async () => {
    if (!csvFile) {
      toast({
        title: 'Error',
        description: 'Selecciona un archivo CSV primero',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const csvContent = await csvFile.text();
      const response = await fetch('/api/artist-import/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent })
      });

      const data: ImportResult = await response.json();

      if (response.ok) {
        setResult(data);
        setStep('result');
        toast({
          title: '¡Importación exitosa!',
          description: `${data.imported} artistas importados correctamente`
        });
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onOpenChange(false);
          resetState();
        }, 2000);
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Error al importar',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error al procesar el archivo',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = 'name,spotifyId,instagramHandle,twitterHandle,email\nArtista Ejemplo,123456789,@instagram,@twitter,artist@example.com';
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
    element.setAttribute('download', 'plantilla_artistas.csv');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetState();
    }}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Artistas desde CSV</DialogTitle>
          <DialogDescription>
            Carga un CSV con datos de artistas. Se buscará automáticamente en Spotify y se activará el webhook de Make.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {step === 'upload' && (
            <>
              {/* Template Info */}
              <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Formato del CSV requerido
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <p className="text-muted-foreground">Las columnas deben ser:</p>
                  <code className="block bg-slate-100 dark:bg-slate-900 p-2 rounded font-mono text-xs overflow-x-auto">
                    name,spotifyId,instagramHandle,twitterHandle,email
                  </code>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={downloadTemplate}
                    className="mt-2"
                  >
                    <Download className="h-3 w-3 mr-2" />
                    Descargar plantilla CSV
                  </Button>
                </CardContent>
              </Card>

              {/* File Upload */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Seleccionar archivo CSV</label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-slate-300 dark:border-slate-700 hover:border-orange-500'
                  }`}
                >
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileInput}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {csvFile ? csvFile.name : 'Arrastra un CSV o haz clic para seleccionar'}
                    </p>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!csvFile || loading}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {loading ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar artistas
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === 'result' && result && (
            <>
              {/* Results Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-xs text-muted-foreground mb-1">Importados</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600">{result.imported}</p>
                </div>
                <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-xs text-muted-foreground mb-1">Errores</p>
                  <p className="text-2xl sm:text-3xl font-bold text-red-600">{result.errors}</p>
                </div>
              </div>

              {/* Artists List */}
              {result.artists.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">✅ Artistas importados:</h4>
                  <ScrollArea className="h-48 border rounded-lg p-3">
                    <div className="space-y-2">
                      {result.artists.map((artist, i) => (
                        <div key={i} className="text-xs p-2 bg-green-50 dark:bg-green-950/20 rounded flex justify-between items-center">
                          <span className="font-medium">{artist.name}</span>
                          {artist.spotifyFollowers && (
                            <Badge variant="secondary" className="text-xs">
                              {artist.spotifyFollowers.toLocaleString()} seguidores
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Errors List */}
              {result.failedArtists.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-red-600">❌ Errores:</h4>
                  <ScrollArea className="h-32 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="space-y-2">
                      {result.failedArtists.map((error, i) => (
                        <div key={i} className="text-xs p-2 bg-red-50 dark:bg-red-950/20 rounded">
                          <p className="font-medium text-red-800 dark:text-red-300">{error.artist}</p>
                          <p className="text-red-600 dark:text-red-400">{error.error}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Success Message */}
              <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                <CardContent className="pt-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm text-green-800 dark:text-green-300">{result.message}</p>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    resetState();
                  }}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  Cerrar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
