/**
 * MusicianImportDialog
 * ────────────────────────────────────────────────────────────
 * Bulk-import musicians from CSV text or a JSON array.
 * Posts to POST /api/musicians/import and shows a summary.
 *
 * Expected columns / keys (any case, spaces/underscores OK):
 *   name (required), instrument, category, description, price,
 *   genres (comma-separated), photo, email, phone, country, city,
 *   spotify, instagram, tiktok, youtube
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { useToast } from '../../hooks/use-toast';
import { Loader2, Upload, FileJson, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ImportSummary {
  total: number;
  success: number;
  skipped: number;
  errors: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

const CSV_EXAMPLE = `name,instrument,category,description,price,genres,email,country,spotify
John Doe,Guitar,Guitar,Session guitarist with 10 years experience,150,"rock,blues",john@example.com,USA,https://open.spotify.com/artist/...
Maria Silva,Vocals,Vocals,Pop & Latin vocalist,200,"pop,latin",maria@example.com,Brazil,`;

const JSON_EXAMPLE = `[
  {
    "name": "John Doe",
    "instrument": "Guitar",
    "category": "Guitar",
    "description": "Session guitarist with 10 years experience",
    "price": 150,
    "genres": ["rock", "blues"],
    "email": "john@example.com",
    "country": "USA"
  }
]`;

export function MusicianImportDialog({ open, onOpenChange, onImported }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'csv' | 'json'>('csv');
  const [csvText, setCsvText] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [createProfiles, setCreateProfiles] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [errorLog, setErrorLog] = useState<Array<{ row: number; error: string }>>([]);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    if (file.name.toLowerCase().endsWith('.json')) {
      setMode('json');
      setJsonText(text);
    } else {
      setMode('csv');
      setCsvText(text);
    }
  };

  const handleImport = async () => {
    setSummary(null);
    setErrorLog([]);
    const payload: Record<string, any> = { createProfiles };
    if (mode === 'csv') {
      if (!csvText.trim()) return toast({ title: 'No data', description: 'Paste CSV content first', variant: 'destructive' });
      payload.csv = csvText;
    } else {
      if (!jsonText.trim()) return toast({ title: 'No data', description: 'Paste JSON content first', variant: 'destructive' });
      payload.json = jsonText;
    }

    setIsImporting(true);
    try {
      const res = await fetch('/api/musicians/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Import failed');
      }
      setSummary(data.summary);
      setErrorLog((data.errorLog || []).slice(0, 50));
      toast({
        title: 'Import complete',
        description: `${data.summary.success} imported, ${data.summary.skipped} skipped, ${data.summary.errors} errors`,
      });
      onImported?.();
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-orange-500" />
            Import Musicians from Database
          </DialogTitle>
          <DialogDescription>
            Bulk-import musicians from CSV or JSON. Profiles will be auto-generated with a
            master record so they can receive messages, contracts and bookings immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'csv' | 'json')}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="csv"><FileSpreadsheet className="h-4 w-4 mr-2" />CSV</TabsTrigger>
              <TabsTrigger value="json"><FileJson className="h-4 w-4 mr-2" />JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="csv" className="space-y-2">
              <Label>CSV content (first line = headers)</Label>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={10}
                placeholder={CSV_EXAMPLE}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Columns: <code>name</code> (required), <code>instrument</code>, <code>category</code>,{' '}
                <code>description</code>, <code>price</code>, <code>genres</code>,{' '}
                <code>photo</code>, <code>email</code>, <code>phone</code>, <code>country</code>,{' '}
                <code>spotify</code>, <code>instagram</code>, <code>tiktok</code>, <code>youtube</code>
              </p>
            </TabsContent>
            <TabsContent value="json" className="space-y-2">
              <Label>JSON array of musicians</Label>
              <Textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={10}
                placeholder={JSON_EXAMPLE}
                className="font-mono text-xs"
              />
            </TabsContent>
          </Tabs>

          <div className="flex flex-col sm:flex-row justify-between gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-800">
            <div className="flex items-center gap-3">
              <input
                type="file"
                id="musician-import-file"
                accept=".csv,.json,.txt"
                className="hidden"
                onChange={handleFilePick}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('musician-import-file')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Load file
              </Button>
              <div className="flex items-center gap-2">
                <Switch checked={createProfiles} onCheckedChange={setCreateProfiles} id="create-profiles" />
                <Label htmlFor="create-profiles" className="text-xs cursor-pointer">
                  Auto-create profiles with master JSON
                </Label>
              </div>
            </div>
            <Button
              onClick={handleImport}
              disabled={isImporting}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isImporting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Import</>
              )}
            </Button>
          </div>

          {summary && (
            <div className="p-4 rounded-lg border border-orange-500/30 bg-orange-500/5 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Import complete
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Total: {summary.total}</Badge>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
                  ✓ {summary.success} imported
                </Badge>
                {summary.skipped > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40">
                    ⤵ {summary.skipped} skipped
                  </Badge>
                )}
                {summary.errors > 0 && (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/40">
                    ✕ {summary.errors} errors
                  </Badge>
                )}
              </div>
              {errorLog.length > 0 && (
                <details className="text-xs mt-2">
                  <summary className="cursor-pointer text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Show issues ({errorLog.length})
                  </summary>
                  <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {errorLog.map((e, i) => (
                      <li key={i} className="text-muted-foreground">
                        Row {e.row}: {e.error}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MusicianImportDialog;
