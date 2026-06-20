import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface ToolTooltipProps {
  name: string;
  description: string;
  icon: any;
  iconColor: string;
  stats: number;
  statsLabel: string;
}

export function ToolTooltip({ name, description, icon: Icon, iconColor, stats, statsLabel }: ToolTooltipProps) {
  return (
    <motion.div 
      className="tool-tooltip" 
      style={{ top: "-120px", left: "50%", transform: "translateX(-50%)" }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3 }}
    >
      <div className="tool-tooltip-title">
        <Icon className={`h-5 w-5 ${iconColor}`} />
        <span>{name}</span>
      </div>
      <div className="tool-tooltip-description">
        {description}
      </div>
      <div className="tool-tooltip-stats">
        <span className="tool-tooltip-stats-value">
          {typeof stats === 'number' ? stats.toLocaleString() : '0'}
        </span>
        <span className="tool-tooltip-stats-label">
          {statsLabel}
        </span>
      </div>
      <div className="tool-tooltip-action">
        Click to launch
      </div>
    </motion.div>
  );
}