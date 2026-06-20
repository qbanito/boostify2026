// ─── Show Package Exporter ────────────────────────────────────────────────────
// Exports the complete show as a JSON master package.

import type { HoloShow } from '../../schemas/holostage/showPackage.schema';

export interface ExportOptions {
  includeWaveformData: boolean;
  includeThumbnails: boolean;
  prettyPrint: boolean;
  embedCharacterMetadata: boolean;
}

export interface ExportResult {
  success: boolean;
  filename?: string;
  sizeBytes?: number;
  error?: string;
}

/**
 * Generates a checksum-like string for the show data.
 */
function generateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Exports the show to a downloadable .holostage.json file.
 */
export async function exportShowPackage(
  show: HoloShow,
  options: ExportOptions = {
    includeWaveformData: false,
    includeThumbnails: false,
    prettyPrint: true,
    embedCharacterMetadata: true,
  }
): Promise<ExportResult> {
  try {
    const exportData = { ...show };

    // Remove potentially large waveform data unless opted in
    if (!options.includeWaveformData) {
      exportData.songs = show.songs.map(s => {
        const { waveformData: _, ...rest } = s;
        return rest;
      });
    }

    // Update timestamps
    exportData.updatedAt = new Date().toISOString();
    exportData.version = '1.0.0';
    exportData.format = 'boostify-holostage-v1';

    // Compute checksum
    const jsonStr = JSON.stringify(exportData);
    exportData.checksum = generateChecksum(jsonStr);

    const finalJson = options.prettyPrint
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData);

    const blob = new Blob([finalJson], { type: 'application/json' });
    const filename = `${sanitizeName(show.name)}_${sanitizeName(show.artistName)}_${formatDate(new Date())}.holostage.json`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, filename, sizeBytes: blob.size };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Parses an imported .holostage.json file.
 */
export async function importShowPackage(file: File): Promise<{ success: boolean; show?: HoloShow; error?: string }> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as HoloShow;

    if (data.format !== 'boostify-holostage-v1') {
      return { success: false, error: 'Formato de archivo no reconocido' };
    }

    return { success: true, show: data };
  } catch (err) {
    return { success: false, error: `Error al parsear: ${String(err)}` };
  }
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
