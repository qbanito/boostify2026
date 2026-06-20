/**
 * ActionCards — Renders clickable action buttons from tool execution results
 * Shows what was done + what the user can do next
 */
import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { CheckCircle2, XCircle, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface ToolAction {
  id: string;
  label: string;
  icon: string;
  type: 'primary' | 'secondary' | 'destructive';
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  payload?: Record<string, any>;
  url?: string;
  confirm?: boolean;
  confirmMessage?: string;
}

export interface ToolResultData {
  success: boolean;
  toolName: string;
  data?: any;
  message: string;
  actions?: ToolAction[];
}

interface ActionCardsProps {
  toolResults: ToolResultData[];
}

export function ActionCards({ toolResults }: ActionCardsProps) {
  if (!toolResults || toolResults.length === 0) return null;

  return (
    <div className="space-y-3 mt-4">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Acciones ejecutadas
      </h4>
      {toolResults.map((result, i) => (
        <ToolResultCard key={`${result.toolName}-${i}`} result={result} index={i} />
      ))}
    </div>
  );
}

function ToolResultCard({ result, index }: { result: ToolResultData; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
    >
      <Card className={`p-4 border-l-4 ${result.success ? 'border-l-green-500 bg-green-500/5' : 'border-l-red-500 bg-red-500/5'}`}>
        <div className="flex items-start gap-3">
          {result.success ? (
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {formatToolName(result.toolName)}
              </Badge>
              {result.success && (
                <Badge className="bg-green-500/20 text-green-400 text-xs">Completado</Badge>
              )}
            </div>
            <p className="text-sm">{result.message}</p>

            {result.actions && result.actions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {result.actions.map((action) => (
                  <ActionButton key={action.id} action={action} />
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function ActionButton({ action }: { action: ToolAction }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleClick = async () => {
    // If it's a URL action, navigate
    if (action.url) {
      if (action.url.startsWith('http')) {
        window.open(action.url, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = action.url;
      }
      return;
    }

    // If it's an API action
    if (action.endpoint) {
      if (action.confirm) {
        const confirmed = window.confirm(action.confirmMessage || '¿Estás seguro?');
        if (!confirmed) return;
      }

      setLoading(true);
      try {
        await apiRequest(action.endpoint, {
          method: action.method || 'POST',
          data: action.payload,
        });
        toast({
          title: "Acción ejecutada",
          description: `${action.label} completado`,
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error?.message || "Error al ejecutar acción",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const variant = action.type === 'primary' ? 'default' :
                   action.type === 'destructive' ? 'destructive' : 'outline';

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className="gap-1.5"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <span className="text-sm">{action.icon}</span>
      )}
      {action.label}
      {action.url && <ExternalLink className="h-3 w-3 ml-1" />}
    </Button>
  );
}

function formatToolName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
