import { useState, useEffect, useRef } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useToast } from "../../hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { auth, db } from "../../firebase";
import { collection, addDoc, getDocs, query, orderBy, Timestamp, where, doc, updateDoc, increment } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getRelevantImage } from "../../lib/unsplash-service";
import { createCheckoutSession } from "../../lib/api/stripe-service";
import { generateCourseContent } from "../../lib/api/openrouter";
import { User, GraduationCap, Star, DollarSign, Plus, Loader2, Clock, Users, Award, Play, ChevronRight, Sparkles, Video, Music, Mic2, Zap, Flame, Headphones, Lightbulb, TrendingUp, Wand2, BookOpen } from "lucide-react";

interface MasterclassFormData {
  title: string;
  description: string;
  price: number;
  musicGenre: string;
  specialization: string;
  level: "Beginner" | "Intermediate" | "Advanced";
}

interface Masterclass {
  id: string;
  title: string;
  description: string;
  price: number;
  musicGenre: string;
  specialization: string;
  level: string;
  thumbnail: string;
  rating: number;
  totalReviews: number;
  duration: string;
  lessons: number;
  enrolledStudents: number;
  content?: any;
  createdAt: Date;
  createdBy: string;
  creatorName: string;
  type: "masterclass";
}

// Sample masterclasses data for demonstration
const sampleMasterclasses: Omit<Masterclass, 'id'>[] = [
  {
    title: "Advanced Electronic Music Production",
    description: "Master the art of electronic music production from concept to final master. Learn sound design, arrangement, mixing techniques and how to create professional-quality tracks.",
    price: 299,
    musicGenre: "Electronic",
    specialization: "Production",
    level: "Advanced",
    thumbnail: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=2000&auto=format&fit=crop",
    rating: 4.9,
    totalReviews: 342,
    duration: "12 hours",
    lessons: 18,
    enrolledStudents: 1245,
    createdAt: new Date(),
    createdBy: "electronic_producer",
    creatorName: "Alex Rivera",
    type: "masterclass",
  },
  {
    title: "Vocal Mixing & Production for Hip-Hop",
    description: "Learn the secrets of professional vocal production in hip-hop from recording to final mix. Master EQ, compression, effects chains, and vocal layering techniques.",
    price: 249,
    musicGenre: "Hip-Hop",
    specialization: "Vocal Production",
    level: "Intermediate",
    thumbnail: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?q=80&w=2000&auto=format&fit=crop",
    rating: 4.8,
    totalReviews: 287,
    duration: "10 hours",
    lessons: 15,
    enrolledStudents: 895,
    createdAt: new Date(),
    createdBy: "hiphop_engineer",
    creatorName: "Marcus Johnson",
    type: "masterclass",
  },
  {
    title: "Mastering for Streaming Platforms",
    description: "Comprehensive guide to mastering music for today's streaming platforms. Learn how to optimize your masters for Spotify, Apple Music, and other services for maximum loudness and clarity.",
    price: 199,
    musicGenre: "All Genres",
    specialization: "Mastering",
    level: "Advanced",
    thumbnail: "https://images.unsplash.com/photo-1558584673-c834fb1cc3ca?q=80&w=2000&auto=format&fit=crop",
    rating: 4.7,
    totalReviews: 156,
    duration: "8 hours",
    lessons: 12,
    enrolledStudents: 723,
    createdAt: new Date(),
    createdBy: "mastering_engineer",
    creatorName: "Sofia Chen",
    type: "masterclass",
  },
  {
    title: "Creating Cinematic Soundscapes",
    description: "Learn how to craft immersive soundscapes and ambient textures for film, games, and modern music production. From field recording to synthesis and processing.",
    price: 279,
    musicGenre: "Ambient/Cinematic",
    specialization: "Sound Design",
    level: "Intermediate",
    thumbnail: "https://images.unsplash.com/photo-1619983081563-430f63602796?q=80&w=2000&auto=format&fit=crop",
    rating: 4.9,
    totalReviews: 203,
    duration: "14 hours",
    lessons: 20,
    enrolledStudents: 562,
    createdAt: new Date(),
    createdBy: "sound_designer",
    creatorName: "James Wilson",
    type: "masterclass",
  }
];

export default function MasterclassSection() {
  const { toast } = useToast();
  const [masterclasses, setMasterclasses] = useState<Masterclass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [newMasterclass, setNewMasterclass] = useState<MasterclassFormData>({
    title: "",
    description: "",
    price: 0,
    musicGenre: "",
    specialization: "",
    level: "Intermediate"
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [hoveredMasterclass, setHoveredMasterclass] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchMasterclasses = async () => {
      try {
        const masterclassesRef = collection(db, 'masterclasses');
        const q = query(masterclassesRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const masterclassesData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date()
          };
        }) as Masterclass[];
        setMasterclasses(masterclassesData);
      } catch (error) {
        console.error('Error fetching masterclasses:', error);
        toast({
          title: "Error",
          description: "Failed to load masterclasses",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMasterclasses();
  }, [toast]);

  // Function to load sample masterclasses if no data exists
  useEffect(() => {
    if (!isLoading && masterclasses.length === 0) {
      const sampleWithIds = sampleMasterclasses.map((masterclass, index) => ({
        ...masterclass,
        id: `sample-${index}`
      })) as Masterclass[];
      
      setMasterclasses(sampleWithIds);
    }
  }, [isLoading, masterclasses.length]);

  const generateRandomMasterclassData = () => {
    return {
      rating: Number((Math.random() * (5 - 4.0) + 4.0).toFixed(1)),
      totalReviews: Math.floor(Math.random() * (500 - 10 + 1)) + 10,
      enrolledStudents: Math.floor(Math.random() * (2000 - 50 + 1)) + 50,
    };
  };

  const handleCreateMasterclass = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Error",
        description: "You must be logged in to create a masterclass",
        variant: "destructive"
      });
      return;
    }

    if (!newMasterclass.title || !newMasterclass.description || !newMasterclass.musicGenre || !newMasterclass.specialization) {
      toast({
        title: "Error",
        description: "Please complete all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsGenerating(true);

      const imagePrompt = `professional musician masterclass ${newMasterclass.musicGenre} ${newMasterclass.specialization} cover image, high quality studio`;
      const thumbnailUrl = await getRelevantImage(imagePrompt);

      const prompt = `Generate a professional masterclass content for artist-engineers with these characteristics:
        - Title: "${newMasterclass.title}"
        - Description: "${newMasterclass.description}"
        - Level: ${newMasterclass.level}
        - Music Genre: ${newMasterclass.musicGenre}
        - Specialization: ${newMasterclass.specialization}

        The masterclass should be focused on the engineering and artistic aspects of music production for this genre. 
        Include technical insights, creative approaches, and practical demonstrations.
        Structure the content for a series of video lessons that would be taught by a successful artist-engineer.`;

      const masterclassContent = await generateCourseContent(prompt);
      const randomData = generateRandomMasterclassData();

      const masterclassData = {
        ...newMasterclass,
        content: masterclassContent,
        thumbnail: thumbnailUrl,
        lessons: masterclassContent.curriculum.length,
        duration: `${Math.ceil(masterclassContent.curriculum.length / 1.5)} hours`,
        ...randomData,
        createdAt: Timestamp.now(),
        createdBy: auth.currentUser?.uid || "",
        creatorName: auth.currentUser?.displayName || "Industry Expert",
        type: "masterclass"
      };

      const masterclassRef = await addDoc(collection(db, 'masterclasses'), masterclassData);

      setMasterclasses(prev => [{
        id: masterclassRef.id,
        ...masterclassData,
        createdAt: new Date()
      } as Masterclass, ...prev]);

      toast({
        title: "Success",
        description: "Masterclass created successfully"
      });

      setNewMasterclass({
        title: "",
        description: "",
        price: 0,
        musicGenre: "",
        specialization: "",
        level: "Intermediate"
      });
    } catch (error: any) {
      console.error('Error creating masterclass:', error);
      toast({
        title: "Error creating masterclass",
        description: error.message || "Failed to create masterclass. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEnrollMasterclass = async (masterclass: Masterclass) => {
    if (!isAuthenticated) {
      toast({
        title: "Error",
        description: "You must be logged in to enroll in a masterclass",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log('Enrolling in masterclass:', masterclass);

      // Verificar si el usuario es administrador (convoycubano@gmail.com)
      if (auth.currentUser?.email === 'convoycubano@gmail.com') {
        // Proceso especial para administrador (sin pago)
        try {
          // Crear un registro de inscripción en Firestore
          if (auth.currentUser?.uid) {
            const enrollmentRef = collection(db, "masterclass_enrollments");
            await addDoc(enrollmentRef, {
              userId: auth.currentUser.uid,
              masterclassId: masterclass.id,
              masterclassTitle: masterclass.title,
              enrollmentDate: new Date(),
              paymentStatus: "admin_access", // Estado especial para admin
              amount: 0, // Sin costo para el administrador
            });
            
            // Actualizar el conteo de inscripciones en el documento del masterclass
            const masterclassRef = doc(db, "masterclasses", masterclass.id);
            await updateDoc(masterclassRef, {
              enrollmentCount: increment(1)
            });
          }
          
          // Mostrar mensaje de éxito
          toast({
            title: "Admin Enrollment Successful",
            description: `As an administrator, you've been enrolled in "${masterclass.title}" without payment.`,
            variant: "default",
          });
        } catch (error) {
          console.error("Error in admin enrollment:", error);
          toast({
            title: "Admin Enrollment",
            description: `Admin access granted for "${masterclass.title}" (enrollment record creation failed, but access is granted)`,
            variant: "default",
          });
        }
        
        setIsLoading(false);
        return;
      }

      // Obtener token del usuario autenticado
      const token = await auth.currentUser?.getIdToken();
      
      if (!token) {
        throw new Error("No se pudo obtener el token de autenticación");
      }
      
      // Usar el ID del curso como priceId temporal para inscripción
      // En un sistema real, esto sería un ID de producto de Stripe registrado
      const priceId = `course_${masterclass.id}`;
      
      await createCheckoutSession(token, priceId);
      
      toast({
        title: "Success",
        description: `Successfully enrolled in ${masterclass.title}`
      });
    } catch (error: any) {
      console.error('Error enrolling in masterclass:', error);
      toast({
        title: "Error",
        description: error.message || "Error enrolling in masterclass. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const getSpecializationIcon = (specialization: string) => {
    switch (specialization.toLowerCase()) {
      case 'production':
        return <Zap className="h-5 w-5 text-orange-500" />;
      case 'vocal production':
        return <Mic2 className="h-5 w-5 text-orange-500" />;
      case 'mastering':
        return <Headphones className="h-5 w-5 text-orange-500" />;
      case 'sound design':
        return <Wand2 className="h-5 w-5 text-orange-500" />;
      default:
        return <Music className="h-5 w-5 text-orange-500" />;
    }
  };

  // Filtrar masterclasses por especialización
  const getMasterclassesBySpecialization = (specialization: string) => {
    if (specialization === 'all') return masterclasses;
    
    return masterclasses.filter(m => {
      return m.specialization.toLowerCase() === specialization;
    });
  };

  return (
    <div className="py-12">
      {/* Banner promocional con gradiente y video de fondo */}
      <div className="relative rounded-xl overflow-hidden mb-16">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-orange-900/40 z-10"></div>
        
        {/* Imagen de fondo (como fallback de video) */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1588479839125-aaf72a37ed19?q=80&w=2000&auto=format&fit=crop"
            className="w-full h-full object-cover opacity-40"
            alt="Music studio background"
          />
        </div>
        
        <div className="relative z-20 py-16 px-8 md:px-12 lg:flex items-center">
          <div className="lg:w-2/3 mb-8 lg:mb-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-500 rounded-full p-2">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <span className="text-orange-300 uppercase font-semibold tracking-wider text-sm">Learn from the best</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">Exclusive</span> Masterclasses by Artist-Engineers
            </h2>
            
            <p className="text-gray-300 text-lg max-w-2xl mb-8">
              Perfect your skills with the most exclusive masterclasses in the market. Learn directly from internationally recognized producers and artists.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full">
                <BookOpen className="h-4 w-4 text-orange-400" />
                <span className="text-gray-200 text-sm">+50 Available Masterclasses</span>
              </div>
              
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full">
                <Users className="h-4 w-4 text-orange-400" />
                <span className="text-gray-200 text-sm">+3,400 Students</span>
              </div>
              
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full">
                <Star className="h-4 w-4 text-orange-400" />
                <span className="text-gray-200 text-sm">4.8 Average Rating</span>
              </div>
            </div>
          </div>
          
          <div className="lg:w-1/3 lg:pl-8">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full py-6 text-lg shadow-lg shadow-orange-500/20 transition-all hover:shadow-xl hover:shadow-orange-500/40">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Create My Masterclass
                </Button>
              </DialogTrigger>
              
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create New Masterclass</DialogTitle>
                  <DialogDescription>
                    Share your experience with the music community. Create a masterclass to teach your production techniques and creative process.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label htmlFor="title" className="text-sm font-medium">Masterclass Title</label>
                    <Input
                      id="title"
                      value={newMasterclass.title}
                      onChange={(e) => setNewMasterclass({ ...newMasterclass, title: e.target.value })}
                      placeholder="e.g., Advanced EDM Production Techniques"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="description" className="text-sm font-medium">Description</label>
                    <Textarea
                      id="description"
                      value={newMasterclass.description}
                      onChange={(e) => setNewMasterclass({ ...newMasterclass, description: e.target.value })}
                      placeholder="Describe what students will learn in your masterclass"
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <label htmlFor="price" className="text-sm font-medium">Price (USD)</label>
                      <Input
                        id="price"
                        type="number"
                        value={newMasterclass.price}
                        onChange={(e) => setNewMasterclass({ ...newMasterclass, price: Number(e.target.value) })}
                        placeholder="Enter price"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="level" className="text-sm font-medium">Level</label>
                      <select
                        id="level"
                        value={newMasterclass.level}
                        onChange={(e) => setNewMasterclass({ ...newMasterclass, level: e.target.value as "Beginner" | "Intermediate" | "Advanced" })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                      >
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="musicGenre" className="text-sm font-medium">Music Genre</label>
                    <Input
                      id="musicGenre"
                      value={newMasterclass.musicGenre}
                      onChange={(e) => setNewMasterclass({ ...newMasterclass, musicGenre: e.target.value })}
                      placeholder="e.g., Electronic, Hip Hop, Rock"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="specialization" className="text-sm font-medium">Specialization</label>
                    <Input
                      id="specialization"
                      value={newMasterclass.specialization}
                      onChange={(e) => setNewMasterclass({ ...newMasterclass, specialization: e.target.value })}
                      placeholder="e.g., Mixing, Sound Design, Arrangement"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateMasterclass} disabled={isGenerating}>
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Masterclass...
                      </>
                    ) : (
                      "Create Masterclass"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
              
            <p className="text-center text-gray-400 mt-4 text-sm">
              Share your knowledge and generate extra income
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            <Video className="h-6 w-6 text-orange-500" />
            Featured Masterclasses
          </h2>
          <p className="text-gray-400 max-w-2xl mt-2">
            The most popular masterclasses taught by successful artist-engineers. Discover production techniques, creative approaches, and industry knowledge.
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="mr-2 h-4 w-4" />
              Create Masterclass
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Masterclass</DialogTitle>
              <DialogDescription>
                Share your experience with the music community. Create a masterclass to teach your production techniques and creative process.
              </DialogDescription>
            </DialogHeader>
            {/* Contenido del diálogo igual que arriba */}
          </DialogContent>
        </Dialog>
      </div>

      {masterclasses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-black/30 rounded-xl border border-gray-800">
          <Video className="h-16 w-16 text-orange-500 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No masterclasses available</h3>
          <p className="text-gray-400 text-center max-w-md mb-6">
            Be the first to create a masterclass and share your experience with the music community.
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600">
                <Plus className="mr-2 h-4 w-4" />
                Create Your Masterclass
              </Button>
            </DialogTrigger>
            {/* Dialog content es el mismo que arriba */}
          </Dialog>
        </div>
      ) : (
        <>
          {/* Categorías de masterclasses */}
          <Tabs defaultValue="all" className="mb-8">
            <TabsList className="grid grid-cols-5 bg-black/40 p-1 rounded-lg">
              <TabsTrigger value="all" className="data-[state=active]:bg-orange-500">
                All
              </TabsTrigger>
              <TabsTrigger value="production" className="data-[state=active]:bg-orange-500">
                <Zap className="h-4 w-4 mr-2" />
                Production
              </TabsTrigger>
              <TabsTrigger value="vocal production" className="data-[state=active]:bg-orange-500">
                <Mic2 className="h-4 w-4 mr-2" />
                Vocals
              </TabsTrigger>
              <TabsTrigger value="mastering" className="data-[state=active]:bg-orange-500">
                <Headphones className="h-4 w-4 mr-2" />
                Mastering
              </TabsTrigger>
              <TabsTrigger value="sound design" className="data-[state=active]:bg-orange-500">
                <Wand2 className="h-4 w-4 mr-2" />
                Sound Design
              </TabsTrigger>
            </TabsList>
            
            {/* Tab: All masterclasses */}
            <TabsContent value="all" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {masterclasses.map((masterclass) => (
                  <motion.div
                    key={masterclass.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    onHoverStart={() => setHoveredMasterclass(masterclass.id)}
                    onHoverEnd={() => setHoveredMasterclass(null)}
                  >
                    <Card className="overflow-hidden bg-black/50 backdrop-blur-sm border-gray-800 group h-full flex flex-col">
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={masterclass.thumbnail}
                          alt={masterclass.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded-full">
                          <span className="text-sm font-medium text-white">{masterclass.level}</span>
                        </div>
                        <div className="absolute top-2 left-2 bg-orange-500/90 px-2 py-1 rounded-full flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-white" />
                          <span className="text-xs font-medium text-white">Masterclass</span>
                        </div>

                        <AnimatePresence>
                          {hoveredMasterclass === masterclass.id && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-black/75 flex flex-col justify-center items-center p-4 space-y-3"
                            >
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                className="rounded-full bg-orange-500 p-3 cursor-pointer hover:bg-orange-600 transition-colors"
                              >
                                <Play className="h-8 w-8 text-white" />
                              </motion.div>
                              <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 20, opacity: 0 }}
                                className="text-center"
                              >
                                <p className="text-white font-medium mb-2">Preview</p>
                                <p className="text-gray-300 text-sm">Watch introduction video</p>
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex items-center gap-2 text-orange-500 text-sm mb-2">
                          {getSpecializationIcon(masterclass.specialization)}
                          <span>{masterclass.specialization}</span>
                          <span>•</span>
                          <Clock className="h-4 w-4" />
                          <span>{masterclass.duration}</span>
                        </div>
                        
                        <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-orange-500 transition-colors">
                          {masterclass.title}
                        </h3>
                        
                        <p className="text-gray-400 mb-4 line-clamp-2">{masterclass.description}</p>

                        <div className="flex items-center gap-2 mb-4">
                          <User className="h-4 w-4 text-orange-500" />
                          <span className="text-sm text-gray-300">By {masterclass.creatorName}</span>
                        </div>

                        <div className="flex justify-between items-center mb-4 mt-auto">
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-orange-500 fill-orange-500" />
                            <span className="font-medium text-white">
                              {typeof masterclass.rating === 'number'
                                ? masterclass.rating.toFixed(1)
                                : parseFloat(String(masterclass.rating)).toFixed(1)}
                            </span>
                            <span className="text-gray-400">({masterclass.totalReviews} reviews)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-orange-500" />
                            <span className="font-medium text-white">${masterclass.price.toFixed(2)}</span>
                          </div>
                        </div>

                        <Button
                          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 group"
                          onClick={() => handleEnrollMasterclass(masterclass)}
                        >
                          {currentUser?.email === 'convoycubano@gmail.com' ? (
                            <>
                              <span>Admin Enrollment (Free)</span>
                              <ChevronRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                            </>
                          ) : (
                            <>
                              <span>Enroll Now (${masterclass.price})</span>
                              <ChevronRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                            </>
                          )}
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
            
            {/* Tabs para diferentes especializaciones */}
            {['production', 'vocal production', 'mastering', 'sound design'].map((specialization) => (
              <TabsContent key={specialization} value={specialization} className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {getMasterclassesBySpecialization(specialization).map((masterclass) => (
                    <motion.div
                      key={masterclass.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="overflow-hidden bg-black/50 backdrop-blur-sm border-gray-800 group h-full flex flex-col">
                        <div className="relative h-48 overflow-hidden">
                          <img
                            src={masterclass.thumbnail}
                            alt={masterclass.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded-full">
                            <span className="text-sm font-medium text-white">{masterclass.level}</span>
                          </div>
                        </div>
                        <div className="p-6 flex-1 flex flex-col">
                          <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-orange-500 transition-colors">
                            {masterclass.title}
                          </h3>
                          <p className="text-gray-400 mb-4 line-clamp-2">{masterclass.description}</p>
                          <div className="flex justify-between items-center mb-4 mt-auto">
                            <div className="flex items-center gap-2">
                              <Star className="h-4 w-4 text-orange-500 fill-orange-500" />
                              <span className="text-white">{masterclass.rating.toFixed(1)}</span>
                            </div>
                            <span className="font-medium text-white">${masterclass.price.toFixed(2)}</span>
                          </div>
                          <Button
                            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                            onClick={() => handleEnrollMasterclass(masterclass)}
                          >
                            {currentUser?.email === 'convoycubano@gmail.com' ? 'Admin Access' : 'Enroll'}
                          </Button>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
          
          {/* Sección de testimonios */}
          <div className="mt-24 mb-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">What Our Students Say</h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Discover the experiences of those who have taken our masterclasses and how they've helped in their music careers.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Testimonio 1 */}
              <div className="bg-gradient-to-br from-black/70 to-orange-950/30 rounded-xl p-6 backdrop-blur-sm border border-orange-900/20">
                <div className="flex items-start mb-4">
                  <div className="flex-shrink-0 mr-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-lg">
                      M
                    </div>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Miguel Rodríguez</h4>
                    <p className="text-orange-400 text-sm">EDM Producer</p>
                  </div>
                </div>
                <p className="text-gray-300 italic mb-4">
                  "La masterclass de Alex Rivera cambió por completo mi enfoque para producir. Sus técnicas de sound design son increíbles y ahora mis tracks suenan mucho más profesionales."
                </p>
                <div className="flex text-yellow-500">
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                </div>
              </div>
              
              {/* Testimonio 2 */}
              <div className="bg-gradient-to-br from-black/70 to-orange-950/30 rounded-xl p-6 backdrop-blur-sm border border-orange-900/20">
                <div className="flex items-start mb-4">
                  <div className="flex-shrink-0 mr-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-lg">
                      L
                    </div>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Laura Medina</h4>
                    <p className="text-orange-400 text-sm">Singer & Producer</p>
                  </div>
                </div>
                <p className="text-gray-300 italic mb-4">
                  "Marcus Johnson me enseñó técnicas de procesamiento vocal que nunca había visto antes. Mi voz ahora suena exactamente como quiero en mis grabaciones."
                </p>
                <div className="flex text-yellow-500">
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                </div>
              </div>
              
              {/* Testimonio 3 */}
              <div className="bg-gradient-to-br from-black/70 to-orange-950/30 rounded-xl p-6 backdrop-blur-sm border border-orange-900/20">
                <div className="flex items-start mb-4">
                  <div className="flex-shrink-0 mr-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-lg">
                      J
                    </div>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Javier Torres</h4>
                    <p className="text-orange-400 text-sm">Mastering Engineer</p>
                  </div>
                </div>
                <p className="text-gray-300 italic mb-4">
                  "Después de la masterclass de Sofia Chen, mis masters para streaming suenan mejor que nunca. Sus técnicas para optimizar el loudness son excepcionales."
                </p>
                <div className="flex text-yellow-500">
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}