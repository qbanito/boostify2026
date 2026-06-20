import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { ToolTooltip } from './tool-tooltip';

interface ToolIconProps {
  id: string;
  icon: any;
  name: string;
  description: string;
  route: string;
  stats: number;
  statsLabel: string;
  color: string;
  onSelect: (id: string) => void;
}

export function ToolIcon({
  id,
  icon: Icon,
  name,
  description,
  route,
  stats,
  statsLabel,
  color,
  onSelect
}: ToolIconProps) {
  return (
    <motion.div className="relative">
      <Link href={route}>
        <div 
          className="h-14 w-14 rounded-full bg-background/40 backdrop-blur-md border border-orange-500/30 shadow-lg flex flex-col items-center justify-center cursor-pointer tool-icon-wrapper relative"
          onClick={() => onSelect(id)}
        >
          <Icon className={`h-6 w-6 ${color}`} />
          
          <div className="ecosystem-tool-label">
            {name}
          </div>
          
          <AnimatePresence>
            {/* Tooltip solo visible en hover */}
            <ToolTooltip
              name={name}
              description={description}
              icon={Icon}
              iconColor={color}
              stats={stats}
              statsLabel={statsLabel}
            />
          </AnimatePresence>
        </div>
      </Link>
    </motion.div>
  );
}