import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logger } from "../../lib/logger";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, User, CheckCircle2, Loader2, Users, Lightbulb, Zap, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MasterCharacterMultiAngle, CharacterPortrait, CastingMember } from "../../lib/api/master-character-generator";
import { Badge } from "@/components/ui/badge";

interface CharacterGenerationModalEnhancedProps {
  open: boolean;
  stage: string;
  progress: number;
  character?: MasterCharacterMultiAngle | null;
  onContinue?: () => void;
}

import { Button } from "@/components/ui/button";

const MOTIVATIONAL_MESSAGES = [
  "✨ Creating your casting-ready character with professional studio lighting...",
  "🎬 Generating from multiple angles for maximum cinematic flexibility...",
  "👥 Building your ensemble cast with diverse talent...",
  "🎨 Applying professional color grading and production-level polish...",
  "🌟 Creating the perfect visual foundation for your music video...",
  "📸 Capturing every angle with Hollywood-quality precision..."
];

const PRO_TIPS = [
  "💡 Pro Tip: Multi-angle characters ensure consistency across all scenes in your video",
  "💡 Pro Tip: The casting members can be easily swapped or modified in post-production",
  "💡 Pro Tip: Professional wardrobe is pre-selected for maximum versatility",
  "💡 Pro Tip: All characters are generated at 8K resolution for future-proof quality",
  "💡 Pro Tip: Use different angles to create dynamic camera movements",
  "💡 Pro Tip: Cast members can be used as background dancers or supporting characters"
];

export function CharacterGenerationModalEnhanced({
  open,
  stage,
  progress,
  character,
  onContinue
}: CharacterGenerationModalEnhancedProps) {
  const stages = [
    { name: "Analyzing facial features...", icon: User, min: 0, max: 20, message: "Reading your unique features with AI precision" },
    { name: "Generating frontal angle...", icon: Sparkles, min: 20, max: 35, message: "Creating professional frontal headshot" },
    { name: "Creating profile angles...", icon: Sparkles, min: 35, max: 60, message: "Building dynamic side profile variations" },
    { name: "Generating three-quarter view...", icon: Sparkles, min: 60, max: 75, message: "Crafting the most flattering three-quarter view" },
    { name: "Creating casting profiles...", icon: Users, min: 75, max: 95, message: "Assembling your ensemble cast" },
    { name: "Finalizing...", icon: CheckCircle2, min: 95, max: 100, message: "Polishing and optimizing final output" }
  ];

  const currentTip = PRO_TIPS[Math.floor(progress / 20) % PRO_TIPS.length];
  const motivationalMsg = MOTIVATIONAL_MESSAGES[Math.floor(progress / 16) % MOTIVATIONAL_MESSAGES.length];

  const currentStage = stages.find(s => progress >= s.min && progress <= s.max) || stages[0];
  const StageIcon = currentStage.icon;

  const angleLabels: Record<string, string> = {
    'frontal': 'Frontal View',
    'left-profile': 'Left Profile',
    'right-profile': 'Right Profile',
    'three-quarter': 'Three-Quarter'
  };

  return (
    <Dialog open={open} modal={true}>
      <DialogContent 
        className="max-w-5xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-gradient-to-r from-orange-500/30 via-purple-500/30 to-pink-500/30 text-white shadow-2xl"
      >
        <DialogHeader className="pb-2">
          <DialogTitle className="text-3xl md:text-4xl font-bold text-center flex items-center justify-center gap-4">
            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="p-3 rounded-xl bg-gradient-to-br from-orange-500/30 via-pink-500/20 to-purple-500/20 border border-orange-500/50"
            >
              <Film className="h-8 w-8 text-orange-400" />
            </motion.div>
            <div className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-pink-400 to-purple-400">
              Crafting Your Character
            </div>
          </DialogTitle>
          <p className="text-center text-slate-400 mt-2">Hollywood-quality casting generation in progress</p>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Motivational Message */}
          <motion.div
            key={progress}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-orange-500/20 via-pink-500/20 to-purple-500/20 border border-orange-500/30 rounded-lg p-4 flex items-start gap-3"
          >
            <Zap className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-orange-300">{motivationalMsg}</p>
            </div>
          </motion.div>

          {/* Progress Bar - Enhanced */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3 flex-1">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <StageIcon className={cn(
                    "h-6 w-6",
                    progress < 100 ? "text-orange-500" : "text-emerald-500"
                  )} />
                </motion.div>
                <div>
                  <p className="font-semibold text-slate-200">{stage || currentStage.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{currentStage.message}</p>
                </div>
              </div>
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                key={Math.round(progress)}
              >
                <Badge className="bg-gradient-to-r from-orange-500 to-pink-500 text-white">
                  {Math.round(progress)}%
                </Badge>
              </motion.div>
            </div>
            <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <motion.div
                layoutId="progress"
                className="h-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 100, damping: 30 }}
              />
            </div>
          </div>

          {/* Character Angles Grid */}
          {character?.mainCharacter.angles && character.mainCharacter.angles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <div className="w-1 h-4 bg-gradient-to-b from-orange-400 to-red-500 rounded" />
                Character Angle Variations
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {character.mainCharacter.angles.map((angle: CharacterPortrait, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative rounded-lg overflow-hidden border border-orange-500/30 aspect-square"
                  >
                    <img
                      src={angle.imageUrl}
                      alt={angleLabels[angle.angle]}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="absolute bottom-1 left-1 bg-black/70 px-2 py-0.5 rounded text-xs font-semibold text-orange-400">
                      {angleLabels[angle.angle]}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Casting Members Grid */}
          {character?.casting && character.casting.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                Cast Members ({character.casting.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {character.casting.map((member: CastingMember, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + idx * 0.1 }}
                    className="space-y-2"
                  >
                    <div className="relative rounded-lg overflow-hidden border border-purple-500/30 aspect-square">
                      <img
                        src={member.imageUrl}
                        alt={member.characterName}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <CheckCircle2 className="w-5 h-5 text-purple-400" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-purple-300 truncate">{member.role}</p>
                      <p className="text-xs text-slate-400">{member.characterName}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Loading State */}
          {!character?.mainCharacter.imageUrl && progress < 100 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative h-40 bg-gradient-to-br from-orange-500/10 to-purple-500/10 rounded-lg border-2 border-dashed border-slate-600/50 flex items-center justify-center"
            >
              <div className="text-center space-y-3">
                <Loader2 className="h-10 w-10 text-orange-500 animate-spin mx-auto" />
                <p className="text-sm text-slate-300">
                  Creating professional studio photography style character profiles...
                </p>
              </div>
            </motion.div>
          )}

          {/* Success State */}
          {character && progress >= 100 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-start gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">Character generation complete!</p>
                <p className="text-xs text-emerald-200/80 mt-1">
                  {character.mainCharacter.angles.length} angle variations + {character.casting.length} cast members ready for your music video
                </p>
              </div>
            </motion.div>
          )}

          {/* Pro Tips Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-indigo-500/20 via-blue-500/20 to-cyan-500/20 border border-blue-500/40 rounded-lg p-4 backdrop-blur-sm"
          >
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-blue-300 flex-shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-2 text-xs">
                <p className="font-semibold text-blue-200">{currentTip}</p>
                <p className="text-blue-200/70">
                  Your character is being generated with professional casting wardrobe, ready for customization in the next steps
                </p>
              </div>
            </div>
          </motion.div>

          {/* Info - Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 flex gap-2"
            >
              <div className="w-1 h-full bg-gradient-to-b from-orange-400 to-red-500 rounded-full" />
              <div className="text-xs">
                <p className="font-semibold text-orange-300">4 Angle Variations</p>
                <p className="text-orange-200/70 mt-0.5">Frontal, profiles & three-quarter</p>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 flex gap-2"
            >
              <div className="w-1 h-full bg-gradient-to-b from-purple-400 to-pink-500 rounded-full" />
              <div className="text-xs">
                <p className="font-semibold text-purple-300">4 Cast Members</p>
                <p className="text-purple-200/70 mt-0.5">Diverse ensemble for your video</p>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 flex gap-2"
            >
              <div className="w-1 h-full bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full" />
              <div className="text-xs">
                <p className="font-semibold text-cyan-300">8K Resolution</p>
                <p className="text-cyan-200/70 mt-0.5">Future-proof quality & detail</p>
              </div>
            </motion.div>
          </div>

          {/* Continue Button - Only show when complete */}
          {progress >= 100 && character && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 100 }}
              className="flex gap-3 pt-6 border-t border-slate-700"
            >
              <Button
                onClick={onContinue}
                className="flex-1 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 hover:from-orange-600 hover:via-pink-600 hover:to-purple-600 text-white font-bold h-12 text-base shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Continue to Concept Generation
              </Button>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
