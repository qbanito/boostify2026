// Futuristic Advisor Card Component
import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Sparkles, ChevronRight, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import type { LucideIcon } from 'lucide-react';

export interface AdvisorData {
  id: string;
  name: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  glowColor: string;
  personality: string;
  expertise: string[];
  specializations: string[];
  status: 'online' | 'busy' | 'offline';
}

interface AdvisorCardProps {
  advisor: AdvisorData;
  index: number;
  onClick: () => void;
  isLocked?: boolean;
}

export function AdvisorCard({ advisor, index, onClick, isLocked = false }: AdvisorCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = advisor.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.1,
        type: 'spring',
        stiffness: 100,
        damping: 15
      }}
      whileHover={{ y: -8, scale: 1.02 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={isLocked ? undefined : onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl cursor-pointer",
        isLocked && "opacity-60 cursor-not-allowed"
      )}
    >
      {/* Background with animated gradient */}
      <div className="absolute inset-0 bg-[#0D0D12] border border-[#1F1F2E] rounded-2xl" />
      
      {/* Animated glow effect on hover */}
      <motion.div
        className={cn("absolute inset-0 opacity-0 transition-opacity duration-500 rounded-2xl")}
        style={{
          background: `radial-gradient(circle at 50% 50%, ${advisor.glowColor}15, transparent 70%)`
        }}
        animate={{ opacity: isHovered ? 1 : 0 }}
      />

      {/* Scanning line effect */}
      <motion.div
        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-0 group-hover:opacity-100"
        animate={isHovered ? {
          top: ['0%', '100%'],
        } : { top: '0%' }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />

      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-orange-500/30 rounded-tl-2xl" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-orange-500/30 rounded-br-2xl" />

      {/* Content */}
      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          {/* Icon with glow */}
          <motion.div 
            className={cn("relative p-4 rounded-xl bg-gradient-to-br", advisor.color)}
            animate={isHovered ? {
              boxShadow: [
                `0 0 20px ${advisor.glowColor}40`,
                `0 0 40px ${advisor.glowColor}60`,
                `0 0 20px ${advisor.glowColor}40`,
              ]
            } : {
              boxShadow: `0 0 10px ${advisor.glowColor}20`
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Icon className="h-6 w-6 text-white" />
            
            {/* Orbiting particle */}
            <motion.div
              className="absolute w-2 h-2 bg-orange-400 rounded-full"
              animate={{
                rotate: 360,
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              style={{
                top: '50%',
                left: '50%',
                transformOrigin: '-15px -15px',
              }}
            />
          </motion.div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <motion.div
              className={cn(
                "w-2 h-2 rounded-full",
                advisor.status === 'online' ? 'bg-green-500' : 
                advisor.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-500'
              )}
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-xs text-gray-400 uppercase">
              {advisor.status}
            </span>
          </div>
        </div>

        {/* Name and title */}
        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-orange-400 transition-colors">
          {advisor.name}
        </h3>
        <p className="text-sm text-gray-400 mb-3">{advisor.title}</p>

        {/* Description */}
        <p className="text-sm text-gray-300 mb-4 line-clamp-2">
          {advisor.description}
        </p>

        {/* Specializations */}
        <div className="flex flex-wrap gap-2 mb-4">
          {advisor.specializations.slice(0, 3).map((spec, i) => (
            <Badge
              key={i}
              variant="outline"
              className="bg-[#1A1A24] border-[#27272A] text-gray-300 text-xs"
            >
              {spec}
            </Badge>
          ))}
        </div>

        {/* Action button */}
        <motion.div
          className={cn(
            "flex items-center justify-between p-3 rounded-xl transition-colors",
            isHovered ? "bg-gradient-to-r from-orange-500/20 to-orange-600/10" : "bg-[#1A1A24]"
          )}
        >
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-gray-300">Start Conversation</span>
          </div>
          <motion.div
            animate={isHovered ? { x: [0, 5, 0] } : { x: 0 }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            <ChevronRight className="h-4 w-4 text-orange-500" />
          </motion.div>
        </motion.div>

        {/* Locked overlay */}
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl">
            <div className="text-center">
              <Zap className="h-8 w-8 text-orange-500 mx-auto mb-2" />
              <p className="text-sm text-gray-300">Upgrade to unlock</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom glow line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500 to-transparent"
        animate={isHovered ? { opacity: 1 } : { opacity: 0.3 }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
}

export default AdvisorCard;
