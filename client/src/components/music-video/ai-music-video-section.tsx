import { motion } from "framer-motion";
import { logger } from "../../lib/logger";
import { Button } from "../ui/button";
import { Link } from "wouter";
import { Video, Wand2 } from "lucide-react";

export function AIMusicVideoSection() {
  return (
    <div className="relative w-full h-[90vh] overflow-hidden">
      {/* Video Background */}
      <div className="absolute inset-0 w-full h-full">
        <iframe
          src="https://www.youtube.com/embed/O90iHkU3cPU?autoplay=1&mute=1&loop=1&playlist=O90iHkU3cPU&controls=0&showinfo=0&rel=0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          className="w-full h-full object-cover"
          style={{ pointerEvents: 'none' }}
        />
        {/* Overlay gradients for better text visibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/30 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto h-full flex flex-col items-center justify-center text-white text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-orange-500 via-orange-300 to-yellow-500"
          >
            AI-Powered Music Production
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-xl md:text-2xl mb-8 text-white/90"
          >
            Transform your music with cutting-edge AI technology. Create stunning music videos, 
            generate unique visuals, and enhance your production quality.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <Link href="/ai-music-video">
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Video className="w-6 h-6 mr-2" />
                Create AI Music Video
              </Button>
            </Link>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16"
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <Wand2 className="w-10 h-10 text-orange-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">AI Visual Generation</h3>
              <p className="text-white/80">Create stunning visuals that match your music's emotion and style</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <Video className="w-10 h-10 text-orange-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Smart Video Editing</h3>
              <p className="text-white/80">Automated editing that syncs perfectly with your beats</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <Wand2 className="w-10 h-10 text-orange-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Style Transfer</h3>
              <p className="text-white/80">Apply unique visual styles inspired by your music genre</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
