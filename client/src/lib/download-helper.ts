import { logger } from "./logger";
/**
 * Utility function to download text content as a file
 * 
 * @param content - The text content to download
 * @param filename - The name of the file to save
 * @returns Promise that resolves when download is complete or rejects on error
 */
export async function downloadTextFile(content: string, filename: string): Promise<void> {
  try {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = filename;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    logger.error("Error downloading file:", error);
    throw error;
  }
}