import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { useAuth } from "../../hooks/use-auth";
import { useToast } from "../../hooks/use-toast";
import { db, storage } from "../../lib/firebase";
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Loader2, Play, Pause, Trash, Pencil, Check, X } from "lucide-react";

interface Song {
  id: string;
  title: string;
  artistId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  format: string;
}

export function MusicManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    loadSongs();
  }, [user]);

  const loadSongs = async () => {
    if (!user) return;

    try {
      const songsRef = collection(db, 'artist_music');
      const q = query(
        songsRef,
        where("artistId", "==", user.id),
        orderBy("uploadedAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const loadedSongs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Song));

      setSongs(loadedSongs);
    } catch (error) {
      logger.error('Error loading songs:', error);
      toast({
        title: "Error",
        description: "Could not load your songs. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files?.length) return;

    const file = event.target.files[0];
    const fileName = file.name;
    const fileFormat = file.type;

    // Validate file type
    if (!fileFormat.match(/^audio\/(mpeg|wav|x-wav)$/)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an MP3 or WAV file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 50MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Upload to Firebase Storage
      const storageRef = ref(storage, `artist_music/${user.id}/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      // Monitor upload progress
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error: any) => {
          logger.error('Error uploading file:', error);
          toast({
            title: "Upload Failed",
            description: "There was an error uploading your song. Please try again.",
            variant: "destructive",
          });
          setIsUploading(false);
          setUploadProgress(0);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

          // Save metadata to Firestore
          const songData = {
            title: fileName.replace(/\.[^/.]+$/, ""), // Remove file extension
            artistId: user.id,
            fileName,
            fileUrl: downloadUrl,
            uploadedAt: new Date(),
            format: fileFormat,
          };

          await addDoc(collection(db, 'artist_music'), songData);
          await loadSongs();

          toast({
            title: "Success",
            description: "Your song has been uploaded successfully.",
          });
          
          setIsUploading(false);
          setUploadProgress(0);
        }
      );
    } catch (error) {
      logger.error('Error uploading file:', error);
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your song. Please try again.",
        variant: "destructive",
      });
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const togglePlay = async (song: Song) => {
    if (currentlyPlaying === song.id) {
      audioElement?.pause();
      setCurrentlyPlaying(null);
      setAudioElement(null);
    } else {
      if (audioElement) {
        audioElement.pause();
      }
      try {
        const audio = new Audio(song.fileUrl);
        await audio.play();
        setAudioElement(audio);
        setCurrentlyPlaying(song.id);

        // Add ended event listener
        audio.addEventListener('ended', () => {
          setCurrentlyPlaying(null);
          setAudioElement(null);
        });
      } catch (error) {
        logger.error('Error playing audio:', error);
        toast({
          title: "Playback Error",
          description: "Could not play the audio file. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const startEditing = (song: Song) => {
    setEditingId(song.id);
    setEditingTitle(song.title);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const saveTitle = async (song: Song) => {
    const trimmed = editingTitle.trim();
    if (!trimmed || trimmed === song.title) {
      cancelEditing();
      return;
    }
    try {
      await updateDoc(doc(db, 'artist_music', song.id), { title: trimmed });
      await loadSongs();
      toast({ title: "Guardado", description: "Nombre de canción actualizado." });
    } catch (error) {
      logger.error('Error updating song title:', error);
      toast({ title: "Error", description: "No se pudo actualizar el nombre.", variant: "destructive" });
    }
    cancelEditing();
  };

  const handleDelete = async (song: Song) => {
    if (!user) return;

    try {
      // Stop playback if the song is currently playing
      if (currentlyPlaying === song.id && audioElement) {
        audioElement.pause();
        setCurrentlyPlaying(null);
        setAudioElement(null);
      }

      // Delete from Storage
      const storageRef = ref(storage, `artist_music/${user.id}/${song.fileName}`);
      await deleteObject(storageRef);

      // Delete from Firestore
      await deleteDoc(doc(db, 'artist_music', song.id));

      toast({
        title: "Success",
        description: "The song has been deleted from your library.",
      });

      await loadSongs();
    } catch (error) {
      logger.error('Error deleting song:', error);
      toast({
        title: "Error",
        description: "Failed to delete the song. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold">Please log in to manage your music.</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Input
            type="file"
            accept="audio/mpeg,audio/wav"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="max-w-xs"
          />
          {isUploading && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                Uploading... {Math.round(uploadProgress)}%
              </span>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-4">
          {songs.map((song) => (
            <Card
              key={song.id}
              className="p-4 bg-black/10 hover:bg-black/20 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => togglePlay(song)}
                  >
                    {currentlyPlaying === song.id ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <div>
                    {editingId === song.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveTitle(song);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          className="h-7 text-sm w-48"
                          autoFocus
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveTitle(song)}>
                          <Check className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEditing}>
                          <X className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{song.title}</p>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50 hover:opacity-100" onClick={() => startEditing(song)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {new Date(song.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDelete(song)}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}