import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Progress } from "../ui/progress";
import { Upload, Download, RefreshCcw, FolderOpen, Trash2, RotateCw, AlertCircle, Check, X } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { storage, db, auth } from "../../firebase";
import { ref, uploadBytesResumable, getDownloadURL, listAll, getMetadata, deleteObject } from "firebase/storage";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, serverTimestamp, orderBy } from "firebase/firestore";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Badge } from "../ui/badge";
import { onAuthStateChanged, User } from "firebase/auth";

interface UploadProgress {
  fileName: string;
  progress: number;
  status: "uploading" | "completed" | "error";
  downloadUrl?: string;
  fileId?: string;
  uploadDate?: Date;
  fileSize?: string;
  fileType?: string;
}

interface FileMetadata {
  id: string;
  name: string;
  downloadUrl: string;
  uploadDate: Date;
  userId: string;
  fileSize: string;
  fileType: string;
}

export function FileExchangeHub() {
  const { toast } = useToast();
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [allFiles, setAllFiles] = useState<FileMetadata[]>([]);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("synced");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [downloadingAll, setDownloadingAll] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [fileToDelete, setFileToDelete] = useState<FileMetadata | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        fetchProjectFiles();
      } else {
        setAllFiles([]);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchProjectFiles = async () => {
    try {
      setSyncStatus("syncing");
      setIsLoading(true);
      
      // Fetch files from Firestore
      const filesRef = collection(db, "projectFiles");
      const q = query(filesRef, orderBy("uploadDate", "desc"));
      const querySnapshot = await getDocs(q);
      
      const fetchedFiles: FileMetadata[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedFiles.push({
          id: doc.id,
          name: data.name,
          downloadUrl: data.downloadUrl,
          uploadDate: data.uploadDate.toDate(),
          userId: data.userId,
          fileSize: data.fileSize || "Unknown",
          fileType: data.fileType || "Unknown"
        });
      });
      
      setAllFiles(fetchedFiles);
      setSyncStatus("synced");
    } catch (error) {
      console.error("Error fetching project files:", error);
      setSyncStatus("error");
      toast({
        title: "Error",
        description: "Failed to fetch project files",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !currentUser) return;

    // Check file size and type
    const validateFile = (file: File): boolean => {
      // Check file size (limit to 100MB)
      const maxSize = 100 * 1024 * 1024; // 100MB in bytes
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds the 100MB limit`,
          variant: "destructive",
        });
        return false;
      }

      // Check file extension for common DAW formats
      const allowedExtensions = [
        ".ptx", ".cpr", ".logic", ".aup", ".flp", ".aif", ".wav", 
        ".mp3", ".als", ".rpp", ".sesx", ".aup3", ".ardour", ".caf",
        ".studio", ".reason", ".rns", ".band", ".aiff", ".mmpz"
      ];
      
      const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (!allowedExtensions.includes(fileExt)) {
        toast({
          title: "Unsupported file type",
          description: `${fileExt} files are not supported`,
          variant: "destructive",
        });
        return false;
      }

      return true;
    };

    Array.from(files).forEach(async (file) => {
      if (!validateFile(file)) return;

      const newUpload: UploadProgress = {
        fileName: file.name,
        progress: 0,
        status: "uploading",
      };

      setUploads(prev => [...prev, newUpload]);

      try {
        // Create a storage reference
        const storageRef = ref(storage, `projectFiles/${currentUser.uid}/${Date.now()}_${file.name}`);
        
        // Upload file
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        // Listen for state changes, errors, and completion
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploads(prev => 
              prev.map(upload => 
                upload.fileName === file.name 
                  ? { ...upload, progress } 
                  : upload
              )
            );
          },
          (error) => {
            console.error("Upload error:", error);
            setUploads(prev =>
              prev.map(upload =>
                upload.fileName === file.name
                  ? { ...upload, status: "error" }
                  : upload
              )
            );
            toast({
              title: "Upload failed",
              description: `Failed to upload ${file.name}`,
              variant: "destructive",
            });
          },
          async () => {
            try {
              // Get the download URL
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              const metadata = await getMetadata(uploadTask.snapshot.ref);
              
              // Format file size
              const fileSize = formatFileSize(metadata.size);
              
              // Save file metadata to Firestore
              const docRef = await addDoc(collection(db, "projectFiles"), {
                name: file.name,
                downloadUrl,
                uploadDate: serverTimestamp(),
                userId: currentUser.uid,
                storagePath: metadata.fullPath,
                fileSize,
                fileType: file.type || getFileTypeFromName(file.name),
              });
              
              // Update uploads state
              setUploads(prev =>
                prev.map(upload =>
                  upload.fileName === file.name
                    ? { 
                        ...upload, 
                        status: "completed", 
                        downloadUrl,
                        fileId: docRef.id,
                        uploadDate: new Date(),
                        fileSize,
                        fileType: file.type || getFileTypeFromName(file.name),
                      }
                    : upload
                )
              );
              
              // Add the new file to allFiles state
              setAllFiles(prev => [{
                id: docRef.id,
                name: file.name,
                downloadUrl,
                uploadDate: new Date(),
                userId: currentUser.uid,
                fileSize,
                fileType: file.type || getFileTypeFromName(file.name),
              }, ...prev]);
              
              toast({
                title: "Upload successful",
                description: `${file.name} has been uploaded`,
              });
            } catch (error) {
              console.error("Error saving file metadata:", error);
              setUploads(prev =>
                prev.map(upload =>
                  upload.fileName === file.name
                    ? { ...upload, status: "error" }
                    : upload
                )
              );
              toast({
                title: "Error",
                description: "Failed to save file metadata",
                variant: "destructive",
              });
            }
          }
        );
      } catch (error) {
        console.error("File upload error:", error);
        setUploads(prev =>
          prev.map(upload =>
            upload.fileName === file.name
              ? { ...upload, status: "error" }
              : upload
          )
        );
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    });
  };

  const handleDownloadAll = async () => {
    if (allFiles.length === 0) {
      toast({
        title: "No files to download",
        description: "Upload some files first",
      });
      return;
    }

    try {
      setDownloadingAll(true);
      
      // If there's only one file, download it directly
      if (allFiles.length === 1) {
        window.open(allFiles[0].downloadUrl, '_blank');
        setDownloadingAll(false);
        return;
      }
      
      toast({
        title: "Preparing download",
        description: "Gathering files for download...",
      });
      
      // For multiple files, create a zip
      const zip = new JSZip();
      
      // Add each file to the zip
      const downloadPromises = allFiles.map(async (file) => {
        try {
          const response = await fetch(file.downloadUrl);
          const blob = await response.blob();
          zip.file(file.name, blob);
          return true;
        } catch (error) {
          console.error(`Error downloading ${file.name}:`, error);
          return false;
        }
      });
      
      await Promise.all(downloadPromises);
      
      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });
      
      // Save the zip file
      saveAs(zipBlob, "project_files.zip");
      
      toast({
        title: "Download complete",
        description: `${allFiles.length} files downloaded as a zip`,
      });
    } catch (error) {
      console.error("Error downloading files:", error);
      toast({
        title: "Download failed",
        description: "Failed to download files",
        variant: "destructive",
      });
    } finally {
      setDownloadingAll(false);
    }
  };

  const handleDownloadFile = (file: FileMetadata) => {
    window.open(file.downloadUrl, '_blank');
    
    toast({
      title: "Download started",
      description: `Downloading ${file.name}...`,
    });
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, "projectFiles", fileToDelete.id));
      
      // Get storage reference to delete the file
      const filesRef = collection(db, "projectFiles");
      const q = query(filesRef, where("name", "==", fileToDelete.name), where("userId", "==", currentUser?.uid));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0].data();
        if (docData.storagePath) {
          const storageRef = ref(storage, docData.storagePath);
          await deleteObject(storageRef);
        }
      }
      
      // Update states
      setAllFiles(prev => prev.filter(file => file.id !== fileToDelete.id));
      setUploads(prev => prev.filter(upload => upload.fileId !== fileToDelete.id));
      
      toast({
        title: "File deleted",
        description: `${fileToDelete.name} has been deleted`,
      });
    } catch (error) {
      console.error("Error deleting file:", error);
      toast({
        title: "Delete failed",
        description: "Failed to delete file",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    }
  };

  const handleSyncClick = () => {
    fetchProjectFiles();
    toast({
      title: "Syncing",
      description: "Refreshing project files...",
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeFromName = (fileName: string): string => {
    const ext = fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase();
    
    const fileTypeMap: {[key: string]: string} = {
      'ptx': 'Pro Tools Project',
      'cpr': 'Cubase Project',
      'logic': 'Logic Pro Project',
      'aup': 'Audacity Project',
      'flp': 'FL Studio Project',
      'als': 'Ableton Live Project',
      'rpp': 'REAPER Project',
      'sesx': 'Adobe Audition Session',
      'aup3': 'Audacity Project (v3)',
      'ardour': 'Ardour Project',
      'band': 'GarageBand Project',
      'rns': 'Reason Project',
      'mp3': 'MP3 Audio',
      'wav': 'WAV Audio',
      'aif': 'AIFF Audio',
      'aiff': 'AIFF Audio',
      'mmpz': 'LMMS Project',
    };
    
    return fileTypeMap[ext] || 'Unknown Project File';
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const renderFileStatus = (upload: UploadProgress) => {
    switch (upload.status) {
      case "uploading":
        return (
          <div className="flex items-center gap-1 text-blue-500">
            <RotateCw className="w-3 h-3 animate-spin" />
            <span className="text-xs">{upload.progress}%</span>
          </div>
        );
      case "completed":
        return (
          <div className="flex items-center gap-1 text-green-500">
            <Check className="w-3 h-3" />
            <span className="text-xs">Completed</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-1 text-red-500">
            <AlertCircle className="w-3 h-3" />
            <span className="text-xs">Failed</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="p-3 sm:p-4 md:p-6 overflow-hidden border-slate-700/50 bg-gradient-to-b from-slate-800/80 to-slate-900/80 backdrop-blur">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0">
            <FolderOpen className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-white truncate">Project Exchange Hub</h3>
            <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block">Share DAW project files & collaborate</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  onClick={handleSyncClick}
                  disabled={syncStatus === "syncing"}
                  className="w-full sm:w-auto"
                  size="sm"
                >
                  {syncStatus === "syncing" ? (
                    <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCcw className="w-4 h-4 mr-2" />
                  )}
                  Sync
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh project files</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  onClick={handleDownloadAll}
                  disabled={downloadingAll || allFiles.length === 0}
                  className="w-full sm:w-auto"
                  size="sm"
                >
                  {downloadingAll ? (
                    <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Download All
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download all project files as a zip</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative border-2 border-dashed border-slate-700 hover:border-orange-500/50 rounded-lg p-4 sm:p-6 text-center transition-colors bg-slate-800/30">
          <input
            type="file"
            multiple
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileUpload}
          />
          <Upload className="w-7 h-7 sm:w-8 sm:h-8 mx-auto mb-2 text-slate-500" />
          <p className="text-xs sm:text-sm font-medium text-slate-300">
            Drag files here or tap to select
          </p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-1">
            .ptx, .cpr, .logic, .aup, .flp, .als, .wav, .mp3 (max 100MB)
          </p>
        </div>

        {/* Recent Uploads */}
        {uploads.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Recent Uploads</h4>
            {uploads.map((upload, index) => (
              <div key={index} className="bg-muted/50 rounded-lg p-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 overflow-hidden w-full">
                    <FolderOpen className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">{upload.fileName}</span>
                      {upload.fileType && (
                        <Badge variant="outline" className="text-xs w-fit">
                          {upload.fileType}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 self-end sm:self-auto">
                    {renderFileStatus(upload)}
                  </div>
                </div>
                <Progress value={upload.progress} className="h-1" />
              </div>
            ))}
          </div>
        )}

        {/* All Project Files */}
        {allFiles.length > 0 && (
          <div className="space-y-3 mt-6">
            <h4 className="text-sm font-medium">All Project Files</h4>
            {allFiles.map((file) => (
              <div key={file.id} className="bg-muted/50 rounded-lg p-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FolderOpen className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium truncate block">{file.name}</span>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {file.fileType}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {file.fileSize}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {formatDate(file.uploadDate)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end mt-2 sm:mt-0">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mr-2 h-8 sm:hidden"
                      onClick={() => handleDownloadFile(file)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      <span>Download</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                          >
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="12" cy="5" r="1" />
                            <circle cx="12" cy="19" r="1" />
                          </svg>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem 
                          onClick={() => handleDownloadFile(file)}
                          className="hidden sm:flex"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          <span>Download</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="hidden sm:block" />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => {
                            setFileToDelete(file);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {allFiles.length === 0 && !isLoading && (
          <div className="text-center p-6 bg-muted/50 rounded-lg mt-4">
            <p className="text-muted-foreground">No project files yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload your first project file to get started
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center p-6 bg-muted/50 rounded-lg mt-4">
            <RotateCw className="w-6 h-6 mx-auto animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">Loading project files...</p>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-[92vw] sm:max-w-md bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle>Delete File</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{fileToDelete?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex space-x-2 justify-end">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button variant="destructive" onClick={handleDeleteFile}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}