// Quick Actions Panel para AI Agents
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  ArrowRight, 
  Music, 
  Video, 
  Camera, 
  Megaphone, 
  Share2, 
  ShoppingBag, 
  Briefcase,
  ChevronDown,
  Sparkles,
  Play,
  ExternalLink
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { Link } from 'wouter';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: any;
  color: string;
  linkedPage: string;
  agentId?: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'compose',
    label: 'Create Song',
    description: 'Generate lyrics & melodies',
    icon: Music,
    color: 'from-orange-500 to-yellow-500',
    linkedPage: '/album-generator',
    agentId: 'composer',
  },
  {
    id: 'video',
    label: 'Make Video',
    description: 'Direct your music video',
    icon: Video,
    color: 'from-purple-500 to-pink-500',
    linkedPage: '/ai-video',
    agentId: 'video-director',
  },
  {
    id: 'photo',
    label: 'Photoshoot',
    description: 'Plan visual content',
    icon: Camera,
    color: 'from-blue-500 to-cyan-500',
    linkedPage: '/ai-photos',
    agentId: 'photographer',
  },
  {
    id: 'marketing',
    label: 'Marketing Plan',
    description: 'Strategy & campaigns',
    icon: Megaphone,
    color: 'from-green-500 to-emerald-500',
    linkedPage: '/marketing',
    agentId: 'marketing',
  },
  {
    id: 'social',
    label: 'Social Media',
    description: 'Content & engagement',
    icon: Share2,
    color: 'from-pink-500 to-rose-500',
    linkedPage: '/instagram-boost',
    agentId: 'social-media',
  },
  {
    id: 'merch',
    label: 'Merchandise',
    description: 'Design products',
    icon: ShoppingBag,
    color: 'from-amber-500 to-orange-500',
    linkedPage: '/merchandise',
    agentId: 'merchandise',
  },
  {
    id: 'manage',
    label: 'Career Strategy',
    description: 'Business planning',
    icon: Briefcase,
    color: 'from-indigo-500 to-purple-500',
    linkedPage: '/manager',
    agentId: 'manager',
  },
];

interface QuickActionsPanelProps {
  onSelectAgent?: (agentId: string) => void;
  className?: string;
  compact?: boolean;
}

export function QuickActionsPanel({ 
  onSelectAgent, 
  className,
  compact = false 
}: QuickActionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between mb-4 cursor-pointer"
        onClick={() => compact && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500 to-purple-500">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
          <Badge className="bg-orange-500/20 text-orange-400 border-0 text-xs">
            {quickActions.length} Tools
          </Badge>
        </div>
        {compact && (
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-5 w-5 text-gray-400" />
          </motion.div>
        )}
      </motion.div>

      {/* Actions Grid */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                const isHovered = hoveredAction === action.id;
                
                return (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onHoverStart={() => setHoveredAction(action.id)}
                    onHoverEnd={() => setHoveredAction(null)}
                    className="relative"
                  >
                    <div
                      className={cn(
                        "group relative p-3 rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden",
                        "bg-[#1C1C24] border-[#27272A]",
                        isHovered && "border-orange-500/50 shadow-lg shadow-orange-500/10"
                      )}
                      onClick={() => {
                        if (action.agentId && onSelectAgent) {
                          onSelectAgent(action.agentId);
                        }
                      }}
                    >
                      {/* Glow effect */}
                      <motion.div
                        className={cn(
                          "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity",
                          `bg-gradient-to-br ${action.color}`
                        )}
                        style={{ opacity: isHovered ? 0.05 : 0 }}
                      />
                      
                      <div className="relative z-10 flex flex-col items-center text-center">
                        <motion.div
                          className={cn("p-2 rounded-lg bg-gradient-to-br mb-2", action.color)}
                          animate={{ 
                            scale: isHovered ? 1.1 : 1,
                            rotate: isHovered ? [0, -5, 5, 0] : 0 
                          }}
                          transition={{ duration: 0.3 }}
                        >
                          <Icon className="h-4 w-4 text-white" />
                        </motion.div>
                        
                        <span className="text-sm font-medium text-white group-hover:text-orange-400 transition-colors">
                          {action.label}
                        </span>
                        
                        <span className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                          {action.description}
                        </span>
                        
                        {/* Action Buttons - Show on hover inside the card */}
                        <AnimatePresence>
                          {isHovered && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="flex gap-1 justify-center mt-2 pt-2 border-t border-[#27272A]/50 w-full"
                            >
                              <Button
                                size="sm"
                                className="h-6 px-2 text-xs bg-orange-500 hover:bg-orange-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (action.agentId && onSelectAgent) {
                                    onSelectAgent(action.agentId);
                                  }
                                }}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Use
                              </Button>
                              <Link href={action.linkedPage}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-xs border-[#27272A] hover:bg-[#27272A]"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Go
                                </Button>
                              </Link>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Bottom tip */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center text-xs text-gray-500 mt-4 flex items-center justify-center gap-1"
            >
              <Sparkles className="h-3 w-3 text-orange-500" />
              Hover over an action to see options
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Compact version for sidebar or header
export function QuickActionsBar({ 
  onSelectAgent 
}: { 
  onSelectAgent?: (agentId: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {quickActions.slice(0, 5).map((action) => {
        const Icon = action.icon;
        return (
          <motion.button
            key={action.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border shrink-0",
              "bg-[#1C1C24] border-[#27272A] hover:border-orange-500/50",
              "transition-colors"
            )}
            onClick={() => action.agentId && onSelectAgent?.(action.agentId)}
          >
            <div className={cn("p-1 rounded bg-gradient-to-br", action.color)}>
              <Icon className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs font-medium text-white">{action.label}</span>
          </motion.button>
        );
      })}
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-xs text-gray-400 hover:text-white"
      >
        More <ArrowRight className="h-3 w-3 ml-1" />
      </Button>
    </div>
  );
}

export default QuickActionsPanel;
