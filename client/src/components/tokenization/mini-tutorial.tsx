import React from 'react';
import { motion } from 'framer-motion';
import { Play, PauseCircle, Star, Zap, Coins, ArrowUpRight, Music2 } from 'lucide-react';
import { Badge } from '../../components/ui/badge';

/**
 * Animated mini-tutorial component that explains the tokenization process
 * with engaging animations and visual steps.
 */
const MiniTutorial = () => {
  // Animation variants for staggered children
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5 }
    }
  };

  // Tutorial steps with animations and content
  const steps = [
    {
      icon: <Music2 className="w-10 h-10 text-purple-500" />,
      title: "Upload Your Catalog",
      description: "Upload your music, videos, images and stems to prepare your complete artist profile.",
      animation: (
        <div className="relative w-full h-32 bg-gray-800 rounded-lg overflow-hidden">
          <motion.div
            initial={{ x: -100 }}
            animate={{ x: 180 }}
            transition={{ 
              repeat: Infinity, 
              duration: 3,
              ease: "linear"
            }}
            className="absolute top-1/2 h-1 w-24 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
          />
          <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ 
              repeat: Infinity, 
              duration: 1.5,
              yoyo: true
            }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Play className="h-12 w-12 text-purple-500" />
          </motion.div>
        </div>
      )
    },
    {
      icon: <Coins className="w-10 h-10 text-purple-500" />,
      title: "Deploy BTF-2300",
      description: "One-click deployment of your artist identity, royalty splitter, and asset tokens on Polygon.",
      animation: (
        <div className="relative w-full h-32 bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center">
          <motion.div
            initial={{ scale: 1, rotate: 0 }}
            animate={{ scale: [1, 1.1, 1], rotate: 360 }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center"
          >
            <Coins className="h-8 w-8 text-white" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 1, 0], scale: [0.8, 1.2, 1.5] }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.5
            }}
            className="absolute inset-0 border-2 border-purple-500 rounded-full"
          />
        </div>
      )
    },
    {
      icon: <Zap className="w-10 h-10 text-purple-500" />,
      title: "Earn & License",
      description: "Automated 80/20 royalty split and on-chain licensing for every transaction.",
      animation: (
        <div className="relative w-full h-32 bg-gray-800 rounded-lg overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: [50, 0, -50], opacity: [0, 1, 0] }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeOut" 
              }}
              className="flex flex-col items-center"
            >
              <Star className="h-8 w-8 text-yellow-400 mb-2" />
              <span className="text-white font-bold text-lg">+$150</span>
            </motion.div>
          </div>
          <motion.div
            initial={{ width: "10%" }}
            animate={{ width: "90%" }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              repeatType: "reverse"
            }}
            className="absolute bottom-4 left-4 right-4 h-4 bg-gradient-to-r from-green-500 to-green-300 rounded-full"
          />
        </div>
      )
    }
  ];

  return (
    <section className="py-24 bg-gray-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-purple-500/20 text-purple-400 border-purple-500/30 px-3 py-1">
            BTF-2300 PROCESS
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            3-Step <span className="text-purple-500">Artist Deployment</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Deploy your complete artist identity on Polygon with our revolutionary BTF-2300 standard
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {steps.map((step, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="bg-gray-800 rounded-xl p-6 hover:shadow-xl transition-shadow duration-300"
            >
              <div className="rounded-full bg-gray-700 w-16 h-16 flex items-center justify-center mb-6">
                {step.icon}
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{step.title}</h3>
              <p className="text-gray-300 mb-6">{step.description}</p>
              
              {/* Animated illustration */}
              {step.animation}
              
              {index === steps.length - 1 && (
                <motion.div 
                  className="mt-6 flex justify-center"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <button className="flex items-center text-purple-500 font-medium hover:text-purple-400 transition-colors">
                    Learn more <ArrowUpRight className="ml-1 h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default MiniTutorial;