import React from 'react';
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Brain } from "lucide-react";

interface BaseAgentProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  onActivate?: () => void;
  onClose?: () => void;
}

export const BaseAgent: React.FC<BaseAgentProps> = ({
  title,
  description,
  icon = <Brain className="h-6 w-6 text-orange-500" />,
  onActivate,
  onClose
}) => {
  return (
    <Card className="p-6 bg-black/50 backdrop-blur-sm border-orange-500/10 relative h-full">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-orange-500/10 rounded-lg">
          {icon}
        </div>
        <div className="flex-1 space-y-2">
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-muted-foreground">{description}</p>
          {onActivate && (
            <Button 
              onClick={onActivate}
              className="bg-orange-500 hover:bg-orange-600 text-white mt-4"
            >
              Activate Agent
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default BaseAgent;