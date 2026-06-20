// Componente de tarjeta de agente con animaciones modernas
import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronRight, 
  Star, 
  TrendingUp, 
  Lightbulb, 
  CheckCircle2,
  Zap,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

interface AgentCardProps {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  category: string;
  trending?: boolean;
  isNew?: boolean;
  useCases?: string[];
  quickTip?: string;
  benefits?: string[];
  isBookmarked?: boolean;
  onSelect: () => void;
  onToggleBookmark: () => void;
  linkedPage?: string;
  linkedPageLabel?: string;
}

export function AgentCard({
  id,
  name,
  description,
  icon: Icon,
  color,
  category,
  trending = false,
  isNew = false,
  useCases = [],
  quickTip,
  benefits = [],
  isBookmarked = false,
  onSelect,
  onToggleBookmark,
  linkedPage,
  linkedPageLabel,
}: AgentCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ duration: 0.3 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="h-full"
    >
      <Card 
        className={cn(
          "h-full bg-[#1C1C24] border-[#27272A] transition-all duration-300 cursor-pointer group relative overflow-hidden",
          isHovered && "border-orange-500/50 shadow-lg shadow-orange-500/10"
        )}
        onClick={onSelect}
      >
        {/* Gradient top bar */}
        <div className={cn("h-1.5 w-full bg-gradient-to-r", color)} />
        
        {/* Glow effect on hover */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-purple-500/5 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />

        {/* Animated particles on hover */}
        {isHovered && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-orange-500/40 rounded-full"
                initial={{ 
                  x: Math.random() * 100 + '%', 
                  y: '100%',
                  opacity: 0 
                }}
                animate={{ 
                  y: '-20%',
                  opacity: [0, 1, 0]
                }}
                transition={{ 
                  duration: 2,
                  delay: i * 0.2,
                  repeat: Infinity
                }}
              />
            ))}
          </div>
        )}

        <CardHeader className="flex flex-row items-start justify-between pb-2 relative z-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              {/* Animated icon container */}
              <motion.div 
                className={cn("p-2.5 rounded-xl bg-gradient-to-br", color)}
                animate={{ 
                  scale: isHovered ? [1, 1.1, 1] : 1,
                  rotate: isHovered ? [0, 5, -5, 0] : 0
                }}
                transition={{ duration: 0.5 }}
              >
                <Icon className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-lg text-white group-hover:text-orange-400 transition-colors">
                    {name}
                  </CardTitle>
                  {trending && (
                    <Badge className="bg-orange-500 text-white hover:bg-orange-600 text-xs flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>Trending</span>
                    </Badge>
                  )}
                  {isNew && (
                    <Badge className="bg-green-500 text-white hover:bg-green-600 text-xs flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      <span>New</span>
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-gray-400 mt-1">
                  {description}
                </CardDescription>
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark();
            }}
          >
            <motion.div
              animate={{ scale: isBookmarked ? [1, 1.3, 1] : 1 }}
              transition={{ duration: 0.3 }}
            >
              <Star className={cn(
                "h-4 w-4 transition-colors",
                isBookmarked ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400 hover:text-yellow-400'
              )} />
            </motion.div>
          </Button>
        </CardHeader>

        <CardContent className="py-2 space-y-3 relative z-10">
          {/* Quick tip */}
          {quickTip && (
            <motion.div 
              className="space-y-1 p-2 rounded-lg bg-orange-500/5 border border-orange-500/10"
              initial={{ opacity: 0.8 }}
              animate={{ opacity: isHovered ? 1 : 0.8 }}
            >
              <div className="flex items-center gap-1 text-orange-500 text-sm">
                <Lightbulb className="h-4 w-4" />
                <span className="font-medium">Pro Tip:</span>
              </div>
              <p className="text-gray-400 text-sm">
                {quickTip}
              </p>
            </motion.div>
          )}
          
          {/* Use cases accordion */}
          {useCases.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="use-cases" className="border-[#27272A]">
                <AccordionTrigger className="text-sm py-2 text-gray-300 hover:text-white hover:no-underline">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-orange-500" />
                    <span>What can this agent do?</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-gray-400">
                  <ul className="space-y-2">
                    {useCases.map((useCase, index) => (
                      <motion.li 
                        key={index}
                        className="flex items-start gap-2"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Zap className="h-3 w-3 text-orange-500 mt-1 shrink-0" />
                        <span>{useCase}</span>
                      </motion.li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Benefits preview */}
          {benefits.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {benefits.slice(0, 2).map((benefit, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-xs border-gray-700 text-gray-400"
                >
                  {benefit}
                </Badge>
              ))}
              {benefits.length > 2 && (
                <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                  +{benefits.length - 2} more
                </Badge>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="border-t border-[#27272A]/50 pt-3 mt-2 flex justify-between relative z-10">
          <motion.div
            whileHover={{ x: 5 }}
            transition={{ duration: 0.2 }}
          >
            <Button 
              variant="ghost" 
              className="gap-1 text-sm font-medium text-orange-500 hover:bg-orange-500/10 p-0"
            >
              <span>Use Agent</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>

          <div className="flex items-center gap-2">
            {linkedPage && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-gray-400 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = linkedPage;
                      }}
                    >
                      <ChevronRight className="h-3 w-3 mr-1" />
                      {linkedPageLabel || 'Go to page'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Navigate to related feature</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-gray-500 px-2 py-1 rounded-full border border-gray-700">
                    {category === "creative" ? "Creative" : 
                     category === "marketing" ? "Marketing" :
                     category === "visual" ? "Visual" : "Business"}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Agent category</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

// Compact version for recent/bookmarked lists
export function AgentCardCompact({
  name,
  description,
  icon: Icon,
  color,
  trending = false,
  isBookmarked = false,
  onSelect,
  onToggleBookmark,
}: Pick<AgentCardProps, 'name' | 'description' | 'icon' | 'color' | 'trending' | 'isBookmarked' | 'onSelect' | 'onToggleBookmark'>) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
        className="bg-[#1C1C24] border-[#27272A] hover:border-orange-500/50 transition-all duration-300 cursor-pointer group"
        onClick={onSelect}
      >
        <CardHeader className="flex flex-row items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg bg-gradient-to-br", color)}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white group-hover:text-orange-400 transition-colors">
                  {name}
                </span>
                {trending && (
                  <TrendingUp className="h-3 w-3 text-orange-500" />
                )}
              </div>
              <p className="text-xs text-gray-400 line-clamp-1">{description}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark();
            }}
          >
            <Star className={cn(
              "h-3 w-3",
              isBookmarked ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'
            )} />
          </Button>
        </CardHeader>
      </Card>
    </motion.div>
  );
}
