      // src/components/ai/base-agent.tsx
import { logger } from "@/lib/logger";

      import { useState } from "react";
      import { Card } from "../ui/card";
      import { Button } from "../ui/button";
      import { Loader2, HelpCircle } from "lucide-react";
      import { ProgressIndicator } from "./progress-indicator";
      import { ActionCards, type ToolResultData } from "./action-cards";
      import { useToast } from "../../hooks/use-toast";
      import {
        Tooltip,
        TooltipContent,
        TooltipProvider,
        TooltipTrigger,
      } from "../ui/tooltip";
      import { Label } from "../ui/label";
      import { Input } from "../ui/input";
      import {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger,
        SelectValue,
      } from "../ui/select";
      import { motion } from "framer-motion";

      export interface AgentTheme {
        gradient: string;
        iconColor: string;
        accentColor: string;
        personality?: string;
      }

      export interface AgentParameter {
        name: string;
        type: "text" | "select" | "number";
        label: string;
        description: string;
        options?: { value: string; label: string }[];
        defaultValue?: string | number;
      }

      export interface AgentResponse {
        id?: string;
        response: string;
        timestamp?: Date;
        toolResults?: ToolResultData[];
      }

      export interface AgentAction {
        name: string;
        description: string;
        parameters?: AgentParameter[];
        action: (params: Record<string, any>) => Promise<void | string | AgentResponse>;
      }

      interface BaseAgentProps {
        name: string;
        description: string;
        icon: React.ElementType;
        actions: AgentAction[];
        helpText?: string;
        theme: AgentTheme;
        children?: React.ReactNode;
      }

      interface ProgressStep {
        message: string;
        timestamp: Date;
      }

      export function BaseAgent({ name, description, icon: Icon, actions, helpText, theme, children }: BaseAgentProps) {
        const [isProcessing, setIsProcessing] = useState(false);
        const [progress, setProgress] = useState(0);
        const [steps, setSteps] = useState<ProgressStep[]>([]);
        const [isComplete, setIsComplete] = useState(false);
        const [toolResults, setToolResults] = useState<ToolResultData[]>([]);

        // Initialize parameters with default values to ensure controlled inputs
        const initialParameters = actions.reduce((acc, action) => {
          if (action.parameters) {
            acc[action.name] = action.parameters.reduce((paramAcc, param) => {
              paramAcc[param.name] = param.defaultValue !== undefined ? param.defaultValue : '';
              return paramAcc;
            }, {} as Record<string, any>);
          }
          return acc;
        }, {} as Record<string, Record<string, any>>);

        const [parameters, setParameters] = useState<Record<string, Record<string, any>>>(initialParameters);
        const { toast } = useToast();

        const addStep = (message: string) => {
          setSteps(prev => [...prev, { message, timestamp: new Date() }]);
        };

        const handleParameterChange = (actionName: string, paramName: string, value: any) => {
          setParameters(prev => ({
            ...prev,
            [actionName]: {
              ...(prev[actionName] || {}),
              [paramName]: value
            }
          }));
        };

        const handleAction = async (action: AgentAction) => {
          try {
            setIsProcessing(true);
            setProgress(0);
            setSteps([]);
            setIsComplete(false);
            setToolResults([]);

            const personalityPrefix = theme.personality ? `[${theme.personality}] ` : "";
            addStep(`${personalityPrefix}Iniciando ${action.name}...`);
            setProgress(10);

            const actionParams = parameters[action.name] || {};
            const result = await action.action(actionParams);

            // If result is an AgentResponse with toolResults, capture them
            if (result && typeof result === 'object' && 'toolResults' in result) {
              const agentResult = result as AgentResponse;
              if (agentResult.toolResults && agentResult.toolResults.length > 0) {
                setToolResults(agentResult.toolResults);
                addStep(`${personalityPrefix}${agentResult.toolResults.length} acciones ejecutadas`);
              }
            }

            setProgress(100);
            setIsComplete(true);
            addStep(`${personalityPrefix}${action.name} completado con éxito`);

            toast({
              title: "Acción completada",
              description: `${action.name} se ha completado correctamente.`,
            });

            return result; // Return result if needed by the caller
          } catch (error: any) {
            const errorMessage = error?.message || `Error al ejecutar ${action.name}. Por favor, intente nuevamente.`;
            const errorStack = error?.stack || 'No stack trace';
            
            logger.error(`Detailed error in ${action.name}:`, {
              message: errorMessage,
              stack: errorStack,
            });
            
            toast({
              title: "Error",
              description: errorMessage,
              variant: "destructive",
            });
          } finally {
            setIsProcessing(false);
          }
        };

        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card
              className="p-6 space-y-6 hover:shadow-lg transition-all duration-300 border-t-4"
              style={{ borderColor: theme.accentColor }}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`h-14 w-14 rounded-xl flex items-center justify-center bg-gradient-to-br ${theme.gradient}`}
                >
                  <Icon className={`h-7 w-7 ${theme.iconColor}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold" style={{ color: theme.accentColor }}>
                      {name}
                    </h3>
                    {helpText && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5">
                              <HelpCircle className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{helpText}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>

              <div className="space-y-6">
                {actions.map((action) => (
                  <motion.div
                    key={action.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4 bg-muted/50 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{action.name}</h4>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>

                    {action.parameters && (
                      <div className="grid gap-4">
                        {action.parameters.map((param) => (
                          <div key={param.name} className="space-y-2">
                            <Label htmlFor={`${action.name}-${param.name}`}>
                              {param.label}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-4 w-4 ml-1">
                                      <HelpCircle className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">{param.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </Label>

                            {param.type === "select" && param.options ? (
                              <Select
                                disabled={isProcessing}
                                value={parameters[action.name]?.[param.name]?.toString() || param.defaultValue?.toString()}
                                onValueChange={(value) => handleParameterChange(action.name, param.name, value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar opción" />
                                </SelectTrigger>
                                <SelectContent>
                                  {param.options.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : param.type === "number" ? (
                              <Input
                                type="number"
                                id={`${action.name}-${param.name}`}
                                value={parameters[action.name]?.[param.name] ?? param.defaultValue ?? ""}
                                onChange={(e) => handleParameterChange(action.name, param.name, e.target.value)}
                                disabled={isProcessing}
                                className="bg-background"
                              />
                            ) : (
                              <Input
                                type="text"
                                id={`${action.name}-${param.name}`}
                                value={parameters[action.name]?.[param.name] ?? param.defaultValue ?? ""}
                                onChange={(e) => handleParameterChange(action.name, param.name, e.target.value)}
                                disabled={isProcessing}
                                className="bg-background"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      onClick={() => handleAction(action)}
                      disabled={isProcessing}
                      className="w-full justify-start gap-2 bg-gradient-to-r hover:opacity-90 transition-opacity"
                      style={{
                        backgroundImage: theme.gradient,
                        color: "white",
                      }}
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Ejecutar {action.name}
                    </Button>
                  </motion.div>
                ))}
              </div>

              {children}

              {(isProcessing || steps.length > 0) && !children && (
                <ProgressIndicator
                  steps={steps}
                  progress={progress}
                  isComplete={isComplete}
                />
              )}

              {toolResults.length > 0 && (
                <ActionCards toolResults={toolResults} />
              )}
            </Card>
          </motion.div>
        );
      }