import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PromoBannerProps {
  onSignupClick: () => void;
}

export function PromoBanner({ onSignupClick }: PromoBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="relative bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 text-white py-3 px-4 shadow-lg"
          data-testid="banner-promo"
        >
          <div className="container mx-auto">
            {/* Desktop Layout */}
            <div className="hidden md:flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Sparkles className="h-5 w-5 flex-shrink-0 animate-pulse" />
                <p className="text-sm md:text-base font-medium truncate">
                  <span className="hidden sm:inline">🎵 The Complete Platform for Artists: </span>
                  <span className="font-bold">Create Music Videos + Marketing</span>
                  <span className="hidden md:inline"> - All in One Place!</span>
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={onSignupClick}
                  className="bg-white text-orange-600 px-4 py-1.5 rounded-full text-sm font-bold hover:bg-orange-50 transition-colors whitespace-nowrap"
                  data-testid="button-signup-banner"
                >
                  Join Free
                </button>
                
                <button
                  onClick={() => setIsVisible(false)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
                  aria-label="Close banner"
                  data-testid="button-close-banner"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Mobile Layout - Stacked */}
            <div className="md:hidden space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Sparkles className="h-5 w-5 flex-shrink-0 animate-pulse" />
                  <p className="text-sm font-medium">
                    <span className="font-bold">Create Music Videos + Marketing</span>
                  </p>
                </div>
                <button
                  onClick={() => setIsVisible(false)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
                  aria-label="Close banner"
                  data-testid="button-close-banner"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="flex justify-center pb-1">
                <button
                  onClick={onSignupClick}
                  className="bg-white text-orange-600 px-6 py-2 rounded-full text-sm font-bold hover:bg-orange-50 transition-colors"
                  data-testid="button-signup-banner"
                >
                  Join Free
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
