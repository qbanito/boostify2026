import { useState, useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { db, storage } from "../../firebase";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import {
  Download,
  Upload,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  FileDown,
  Plus,
  Loader2,
  File,
  Music2,
  FileText,
  FileArchive,
  Image as ImageIcon,
  X,
  Check,
  Shield,
  AlertCircle,
  Link2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";

interface DownloadItem {
  id: string;
  artistId: string;
  fileName: string;
  displayName: string;
  description: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  password: string;
  downloadCount: number;
  createdAt: string;
  isActive: boolean;
  itemType: 'file' | 'link';
  linkUrl?: string;
}

interface ArtistDownloadsProps {
  artistId: string;
  pgId?: number;
  isOwner: boolean;
  colors?: {
    hexPrimary: string;
    hexAccent: string;
    hexBorder: string;
    hexBg: string;
  };
}

// Simple hash for password (not crypto-secure, but sufficient for downloadable content gating)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

function getFileIcon(fileType: string, itemType?: string) {
  if (itemType === 'link') return Link2;
  if (fileType.startsWith('audio/')) return Music2;
  if (fileType.startsWith('image/')) return ImageIcon;
  if (fileType.includes('pdf') || fileType.includes('document') || fileType.includes('text')) return FileText;
  if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('7z') || fileType.includes('tar')) return FileArchive;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function ArtistDownloads({ artistId, pgId, isOwner, colors }: ArtistDownloadsProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultColors = {
    hexPrimary: '#8b5cf6',
    hexAccent: '#a78bfa',
    hexBorder: '#374151',
    hexBg: '#111111',
  };
  const c = colors || defaultColors;

  // State
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedDownload, setSelectedDownload] = useState<DownloadItem | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Upload form state
  const [uploadType, setUploadType] = useState<'file' | 'link'>('file');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLinkUrl, setUploadLinkUrl] = useState('');
  const [uploadDisplayName, setUploadDisplayName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadPassword, setUploadPassword] = useState('');
  const [showUploadPassword, setShowUploadPassword] = useState(false);

  // Load downloads from Firestore
  const loadDownloads = async () => {
    try {
      setLoading(true);
      const downloadsRef = collection(db, "artist_downloads");
      
      // Try multiple ID formats (same pattern as galleries)
      const possibleIds = [
        String(artistId),
        String(pgId || ''),
        artistId,
      ].filter(Boolean);

      const uniqueIds = possibleIds.filter((id, index) => possibleIds.indexOf(id) === index);
      let allDownloads: DownloadItem[] = [];

      for (const id of uniqueIds) {
        const q = query(downloadsRef, where("artistId", "==", id));
        const snapshot = await getDocs(q);
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Avoid duplicates
          if (!allDownloads.find(d => d.id === doc.id)) {
            allDownloads.push({
              id: doc.id,
              artistId: data.artistId,
              fileName: data.fileName,
              displayName: data.displayName,
              description: data.description || '',
              fileUrl: data.fileUrl,
              fileSize: data.fileSize || 0,
              fileType: data.fileType || 'application/octet-stream',
              password: data.password,
              downloadCount: data.downloadCount || 0,
              createdAt: data.createdAt,
              isActive: data.isActive !== false,
              itemType: data.itemType || 'file',
              linkUrl: data.linkUrl || undefined,
            });
          }
        });
      }

      // Sort by date, newest first
      allDownloads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setDownloads(allDownloads.filter(d => d.isActive || isOwner));
    } catch (error) {
      logger.error("Error loading downloads:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (artistId) {
      loadDownloads();
    }
  }, [artistId, pgId]);

  // Upload handler (file or link)
  const handleUpload = async () => {
    if (!uploadDisplayName.trim() || !uploadPassword.trim()) {
      toast({
        title: "Required fields",
        description: "Name and password are required",
        variant: "destructive",
      });
      return;
    }

    if (uploadType === 'file' && !uploadFile) {
      toast({
        title: "File required",
        description: "Select a file to upload",
        variant: "destructive",
      });
      return;
    }

    if (uploadType === 'link' && !uploadLinkUrl.trim()) {
      toast({
        title: "Link required",
        description: "Enter the link URL",
        variant: "destructive",
      });
      return;
    }

    if (uploadPassword.length < 4) {
      toast({
        title: "Password too short",
        description: "Password must be at least 4 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const consistentId = String(pgId || artistId);
      let fileUrl = '';
      let fileSize = 0;
      let fileType = 'link';
      let fileName = '';

      if (uploadType === 'file' && uploadFile) {
        const timestamp = Date.now();
        const safeFileName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `artist-downloads/${consistentId}/${timestamp}_${safeFileName}`;
        const storageRef = ref(storage, storagePath);

        // Upload with progress tracking
        const uploadTask = uploadBytesResumable(storageRef, uploadFile, {
          contentType: uploadFile.type,
          customMetadata: {
            artistId: consistentId,
            displayName: uploadDisplayName,
          },
        });

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );
              setUploadProgress(progress);
            },
            (error) => {
              logger.error("Upload error:", error);
              reject(error);
            },
            () => resolve()
          );
        });

        fileUrl = await getDownloadURL(storageRef);
        fileSize = uploadFile.size;
        fileType = uploadFile.type;
        fileName = uploadFile.name;
      } else {
        // Link type
        fileUrl = uploadLinkUrl.trim();
        fileName = uploadLinkUrl.trim();
        setUploadProgress(100);
      }

      // Save metadata to Firestore
      const downloadRef = doc(collection(db, "artist_downloads"));
      const downloadData: Omit<DownloadItem, 'id'> = {
        artistId: consistentId,
        fileName,
        displayName: uploadDisplayName.trim(),
        description: uploadDescription.trim(),
        fileUrl,
        fileSize,
        fileType,
        password: simpleHash(uploadPassword.trim()),
        downloadCount: 0,
        createdAt: new Date().toISOString(),
        isActive: true,
        itemType: uploadType,
        linkUrl: uploadType === 'link' ? uploadLinkUrl.trim() : undefined,
      };

      await setDoc(downloadRef, downloadData);

      toast({
        title: uploadType === 'file' ? "File uploaded" : "Link saved",
        description: `"${uploadDisplayName}" ready with password`,
      });

      // Reset form
      setShowUploadDialog(false);
      setUploadFile(null);
      setUploadLinkUrl('');
      setUploadDisplayName('');
      setUploadDescription('');
      setUploadPassword('');
      setUploadProgress(0);
      setUploadType('file');

      // Reload
      await loadDownloads();
    } catch (error: any) {
      logger.error("Error uploading download:", error);
      toast({
        title: "Error",
        description: error.message || "Could not complete the operation",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Password verification and download
  const handlePasswordSubmit = async () => {
    if (!selectedDownload || !passwordInput.trim()) return;

    const inputHash = simpleHash(passwordInput.trim());
    if (inputHash === selectedDownload.password) {
      // Password correct - open download
      try {
        // Increment download count
        const downloadRef = doc(db, "artist_downloads", selectedDownload.id);
        await updateDoc(downloadRef, {
          downloadCount: (selectedDownload.downloadCount || 0) + 1,
        });

        // Open file URL
        window.open(selectedDownload.fileUrl, '_blank');

        toast({
          title: "Download started",
          description: `Downloading "${selectedDownload.displayName}"`,
        });

        setShowPasswordDialog(false);
        setSelectedDownload(null);
        setPasswordInput('');
        setPasswordError(false);

        // Update local count
        setDownloads(prev =>
          prev.map(d =>
            d.id === selectedDownload.id
              ? { ...d, downloadCount: d.downloadCount + 1 }
              : d
          )
        );
      } catch (error) {
        logger.error("Error updating download count:", error);
        // Still open the file even if count update fails
        window.open(selectedDownload.fileUrl, '_blank');
      }
    } else {
      setPasswordError(true);
      toast({
        title: "Incorrect password",
        description: "The password is not valid. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Delete download
  const handleDelete = async (downloadId: string) => {
    try {
      const download = downloads.find(d => d.id === downloadId);
      if (!download) return;

      // Delete from Storage
      try {
        const fileRef = ref(storage, download.fileUrl);
        await deleteObject(fileRef);
      } catch (e) {
        logger.warn("Could not delete file from storage:", e);
      }

      // Delete from Firestore
      await deleteDoc(doc(db, "artist_downloads", downloadId));

      toast({
        title: "File deleted",
        description: `"${download.displayName}" has been deleted`,
      });

      setDeleteConfirmId(null);
      await loadDownloads();
    } catch (error) {
      logger.error("Error deleting download:", error);
      toast({
        title: "Error deleting",
        description: "Could not delete the file",
        variant: "destructive",
      });
    }
  };

  // If loading
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: c.hexAccent }} />
      </div>
    );
  }

  // If no downloads and not owner, show nothing
  if (downloads.length === 0 && !isOwner) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Owner: Upload button */}
      {isOwner && (
        <div className="flex justify-end">
          <Button
            onClick={() => setShowUploadDialog(true)}
            size="sm"
            className="gap-2 rounded-xl text-xs font-semibold shadow-lg transition-all hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${c.hexPrimary}, ${c.hexAccent})`,
              color: 'white',
            }}
          >
            <Plus className="h-4 w-4" />
            Upload Download
          </Button>
        </div>
      )}

      {/* Downloads list */}
      <AnimatePresence>
        {downloads.map((download, index) => {
          const FileIcon = getFileIcon(download.fileType, download.itemType);
          return (
            <motion.div
              key={download.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.08 }}
              className="group relative rounded-xl border p-4 transition-all duration-300 hover:shadow-lg"
              style={{
                borderColor: c.hexBorder,
                backgroundColor: `${c.hexPrimary}08`,
              }}
            >
              <div className="flex items-center gap-4">
                {/* File icon */}
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${c.hexPrimary}25, ${c.hexAccent}15)`,
                  }}
                >
                  <FileIcon className="h-6 w-6" style={{ color: c.hexAccent }} />
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white truncate">
                    {download.displayName}
                  </h4>
                  {download.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                      {download.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {download.itemType === 'link' ? (
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <Link2 className="h-2.5 w-2.5" />
                        Link
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-500">
                        {formatFileSize(download.fileSize)}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5" />
                      Protected
                    </span>
                    {isOwner && (
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <Download className="h-2.5 w-2.5" />
                        {download.downloadCount} downloads
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    onClick={() => {
                      setSelectedDownload(download);
                      setPasswordInput('');
                      setPasswordError(false);
                      setShowPasswordDialog(true);
                    }}
                    size="sm"
                    className="gap-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                    style={{
                      background: `linear-gradient(135deg, ${c.hexPrimary}, ${c.hexAccent})`,
                      color: 'white',
                    }}
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Download
                  </Button>

                  {isOwner && (
                    <Button
                      onClick={() => setDeleteConfirmId(download.id)}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-400 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Owner badge for inactive items */}
              {isOwner && !download.isActive && (
                <Badge variant="outline" className="absolute top-2 right-2 text-[10px] text-yellow-400 border-yellow-400/30">
                  Inactive
                </Badge>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Empty state for owner */}
      {downloads.length === 0 && isOwner && (
        <div className="text-center py-8 space-y-3">
          <FileDown className="h-10 w-10 mx-auto text-gray-600" />
          <p className="text-sm text-gray-400">
            No downloadable files yet
          </p>
          <p className="text-xs text-gray-500">
            Upload password-protected files for your fans
          </p>
        </div>
      )}

      {/* ========== Upload Dialog ========== */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md bg-[#1a1a2e] border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Upload className="h-5 w-5" style={{ color: c.hexAccent }} />
              Upload Download
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Upload a password-protected file or link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type toggle */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={uploadType === 'file' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUploadType('file')}
                className={`flex-1 gap-1.5 rounded-xl text-xs font-medium transition-all ${
                  uploadType === 'file' ? '' : 'border-gray-600 text-gray-400 hover:text-white'
                }`}
                style={uploadType === 'file' ? { background: `linear-gradient(135deg, ${c.hexPrimary}, ${c.hexAccent})`, color: 'white' } : {}}
              >
                <Upload className="h-3.5 w-3.5" />
                File
              </Button>
              <Button
                type="button"
                variant={uploadType === 'link' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUploadType('link')}
                className={`flex-1 gap-1.5 rounded-xl text-xs font-medium transition-all ${
                  uploadType === 'link' ? '' : 'border-gray-600 text-gray-400 hover:text-white'
                }`}
                style={uploadType === 'link' ? { background: `linear-gradient(135deg, ${c.hexPrimary}, ${c.hexAccent})`, color: 'white' } : {}}
              >
                <Link2 className="h-3.5 w-3.5" />
                Link
              </Button>
            </div>

            {/* File picker or Link input */}
            {uploadType === 'file' ? (
            <div>
              <Label className="text-gray-300 text-sm">File *</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadFile(file);
                    if (!uploadDisplayName) {
                      setUploadDisplayName(file.name.replace(/\.[^/.]+$/, ''));
                    }
                  }
                }}
              />
              {uploadFile ? (
                <div className="mt-1 flex items-center gap-3 p-3 rounded-lg bg-black/30 border border-gray-700">
                  <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{uploadFile.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(uploadFile.size)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setUploadFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full mt-1 border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 h-20"
                >
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-5 w-5" />
                    <span className="text-xs">Click to select a file</span>
                    <span className="text-[10px] text-gray-500">MP3, WAV, PDF, ZIP, IMG, etc.</span>
                  </div>
                </Button>
              )}
            </div>
            ) : (
            <div>
              <Label className="text-gray-300 text-sm">Link URL *</Label>
              <Input
                value={uploadLinkUrl}
                onChange={(e) => setUploadLinkUrl(e.target.value)}
                placeholder="https://drive.google.com/... , https://wetransfer.com/..."
                className="mt-1 bg-black/30 border-gray-700 text-white placeholder:text-gray-500"
                maxLength={500}
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Google Drive, Dropbox, WeTransfer, or any URL
              </p>
            </div>
            )}

            {/* Display name */}
            <div>
              <Label className="text-gray-300 text-sm">Resource name *</Label>
              <Input
                value={uploadDisplayName}
                onChange={(e) => setUploadDisplayName(e.target.value)}
                placeholder="E.g.: Beat Pack Vol.1, Press Kit, Stems..."
                className="mt-1 bg-black/30 border-gray-700 text-white placeholder:text-gray-500"
                maxLength={100}
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-gray-300 text-sm">Description (optional)</Label>
              <Input
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Brief description of the content..."
                className="mt-1 bg-black/30 border-gray-700 text-white placeholder:text-gray-500"
                maxLength={200}
              />
            </div>

            {/* Password */}
            <div>
              <Label className="text-gray-300 text-sm flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" style={{ color: c.hexAccent }} />
                Download password *
              </Label>
              <div className="relative mt-1">
                <Input
                  type={showUploadPassword ? "text" : "password"}
                  value={uploadPassword}
                  onChange={(e) => setUploadPassword(e.target.value)}
                  placeholder="Minimum 4 characters"
                  className="bg-black/30 border-gray-700 text-white placeholder:text-gray-500 pr-10"
                  maxLength={50}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUploadPassword(!showUploadPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-gray-400 hover:text-white"
                >
                  {showUploadPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Share this password with those you want to allow to download the file
              </p>
            </div>

            {/* Upload progress */}
            {uploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-black/30 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${c.hexPrimary}, ${c.hexAccent})` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowUploadDialog(false)}
              disabled={uploading}
              className="text-gray-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || (uploadType === 'file' ? !uploadFile : !uploadLinkUrl.trim()) || !uploadDisplayName.trim() || !uploadPassword.trim()}
              className="gap-2 rounded-xl font-semibold"
              style={{
                background: `linear-gradient(135deg, ${c.hexPrimary}, ${c.hexAccent})`,
                color: 'white',
              }}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {uploadType === 'file' ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                <>
                  {uploadType === 'file' ? <Upload className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  {uploadType === 'file' ? 'Upload File' : 'Save Link'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== Password Dialog (Public) ========== */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => {
        setShowPasswordDialog(open);
        if (!open) {
          setPasswordInput('');
          setPasswordError(false);
          setSelectedDownload(null);
        }
      }}>
        <DialogContent className="sm:max-w-sm bg-[#1a1a2e] border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield className="h-5 w-5" style={{ color: c.hexAccent }} />
              Protected Content
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter the password to download{' '}
              <span className="text-white font-medium">"{selectedDownload?.displayName}"</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-gray-300 text-sm flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" style={{ color: c.hexAccent }} />
                Password
              </Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePasswordSubmit();
                  }}
                  placeholder="Enter the password..."
                  className={`bg-black/30 border-gray-700 text-white placeholder:text-gray-500 pr-10 ${
                    passwordError ? 'border-red-500 focus:ring-red-500' : ''
                  }`}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              {passwordError && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Incorrect password
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowPasswordDialog(false)}
              className="text-gray-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePasswordSubmit}
              disabled={!passwordInput.trim()}
              className="gap-2 rounded-xl font-semibold"
              style={{
                background: `linear-gradient(135deg, ${c.hexPrimary}, ${c.hexAccent})`,
                color: 'white',
              }}
            >
              <Download className="h-4 w-4" />
              Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== Delete Confirmation ========== */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-[#1a1a2e] border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Eliminar descargable?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This action cannot be undone. The file will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-gray-400 border-gray-600">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
