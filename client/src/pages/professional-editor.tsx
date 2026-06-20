import { Header } from "../components/layout/header";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { 
  Video, 
  Play, 
  Download, 
  Share2, 
  Eye,
  Calendar,
  Clock,
  Film,
  Sparkles
} from "lucide-react";

interface VideoItem {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  createdAt: string;
  director?: string;
  style?: string;
  views?: number;
}

const demoVideos: VideoItem[] = [
  {
    id: "1",
    title: "Sunset Dreams - AI Generated",
    thumbnail: "/placeholder-video-1.jpg",
    duration: "3:45",
    createdAt: "2024-11-10",
    director: "AI Director",
    style: "Cinematic",
    views: 1250
  },
  {
    id: "2",
    title: "Urban Rhythms - Christopher Nolan Style",
    thumbnail: "/placeholder-video-2.jpg",
    duration: "4:20",
    createdAt: "2024-11-08",
    director: "Christopher Nolan (AI)",
    style: "Dark & Dramatic",
    views: 2340
  },
  {
    id: "3",
    title: "Neon Nights - Wes Anderson Style",
    thumbnail: "/placeholder-video-3.jpg",
    duration: "3:15",
    createdAt: "2024-11-05",
    director: "Wes Anderson (AI)",
    style: "Symmetrical & Colorful",
    views: 890
  }
];

export default function GalleryPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-500/10 rounded-lg">
              <Film className="w-8 h-8 text-orange-500" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-orange-300 bg-clip-text text-transparent">
                Video Gallery
              </h1>
              <p className="text-muted-foreground mt-1">
                Your AI-generated music videos and creations
              </p>
            </div>
          </div>
        </motion.div>

        {demoVideos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-500/10 mb-6">
              <Video className="w-10 h-10 text-orange-500" />
            </div>
            <h2 className="text-2xl font-bold mb-3">No videos yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start creating amazing music videos with our AI-powered tools. Your generated videos will appear here.
            </p>
            <Button size="lg" className="gap-2">
              <Sparkles className="w-5 h-5" />
              Create Your First Video
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {demoVideos.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="overflow-hidden hover:shadow-xl transition-shadow duration-300 border-orange-500/20 hover:border-orange-500/40">
                  <div className="relative aspect-video bg-gradient-to-br from-orange-500/20 to-purple-500/20">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <Video className="w-16 h-16 text-orange-500/40 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Video Preview</p>
                      </div>
                    </div>
                    
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-black/70 text-white border-orange-500/50">
                        {video.duration}
                      </Badge>
                    </div>
                    
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <Button 
                        size="lg" 
                        className="gap-2 bg-orange-500 hover:bg-orange-600"
                        data-testid={`button-play-${video.id}`}
                      >
                        <Play className="w-5 h-5" />
                        Play
                      </Button>
                    </div>
                  </div>
                  
                  <CardHeader>
                    <CardTitle className="text-lg line-clamp-1" data-testid={`text-title-${video.id}`}>
                      {video.title}
                    </CardTitle>
                    <CardDescription>
                      <div className="flex flex-col gap-2 mt-2">
                        {video.director && (
                          <div className="flex items-center gap-2 text-xs">
                            <Film className="w-4 h-4" />
                            <span>{video.director}</span>
                          </div>
                        )}
                        {video.style && (
                          <Badge variant="outline" className="w-fit text-xs">
                            {video.style}
                          </Badge>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                          </div>
                          {video.views && (
                            <div className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              <span>{video.views.toLocaleString()} views</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 gap-2"
                        data-testid={`button-download-${video.id}`}
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 gap-2"
                        data-testid={`button-share-${video.id}`}
                      >
                        <Share2 className="w-4 h-4" />
                        Share
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {demoVideos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 text-center"
          >
            <p className="text-muted-foreground mb-4">
              Showing {demoVideos.length} video{demoVideos.length !== 1 ? 's' : ''}
            </p>
            <Button variant="outline" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Create New Video
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
