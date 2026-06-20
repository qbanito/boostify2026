// src/components/ai/merchandise-agent.tsx
import { logger } from "@/lib/logger";

import { ShoppingBag, Save, Download } from "lucide-react";
import { BaseAgent, type AgentAction, type AgentTheme } from "./base-agent";
import { useState } from "react";
import { geminiAgentsService } from "../../lib/api/gemini-agents-service";
import { aiAgentsFirestore } from "../../lib/services/ai-agents-firestore";
import { useAuth } from "../../hooks/use-auth";
import { useToast } from "../../hooks/use-toast";
import { Button } from "../ui/button";

export function MerchandiseAgent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [result, setResult] = useState<string | null>(null);

  const theme: AgentTheme = {
    gradient: "from-amber-500 to-yellow-600",
    iconColor: "text-white",
    accentColor: "#F59E0B",
    personality: "🛍️ Creative Designer",
  };

  const saveToFirestore = async (data: {
    ideas: string;
    params: any;
  }) => {
    if (!user) return;

    try {
      await aiAgentsFirestore.saveMerchandiseIdeas(
        user.uid,
        data.ideas,
        {
          artistStyle: data.params.style,
          targetMarket: data.params.productType
        }
      );

      logger.info('✅ Merchandise ideas saved to Firestore with Gemini integration');
    } catch (error) {
      logger.error('Error saving to Firestore:', error);
      // Don't throw - continue even if save fails
    }
  };

  const actions: AgentAction[] = [
    {
      name: "Design products",
      description: "Generate designs for merchandise",
      parameters: [
        {
          name: "productType",
          type: "select",
          label: "Product Type",
          description: "Select the type of product to design",
          options: [
            { value: "tshirt", label: "T-Shirts" },
            { value: "hoodie", label: "Hoodies" },
            { value: "accessories", label: "Accessories" },
            { value: "prints", label: "Prints/Posters" },
          ],
          defaultValue: "tshirt",
        },
        {
          name: "style",
          type: "select",
          label: "Design Style",
          description: "Visual style for merchandise",
          options: [
            { value: "minimal", label: "Minimalist" },
            { value: "artistic", label: "Artistic" },
            { value: "urban", label: "Urban" },
            { value: "vintage", label: "Vintage" },
          ],
          defaultValue: "minimal",
        },
      ],
      action: async (params) => {
        if (!user) {
          toast({
            title: "Authentication Required",
            description: "Please log in to use the Merchandise Designer AI.",
            variant: "destructive",
          });
          return;
        }
        try {
          const ideas = await geminiAgentsService.generateMerchandiseIdeas({
            artistStyle: params.style,
            targetMarket: params.productType
          });

          setResult(ideas);
          
          // Guardar automáticamente en Firestore
          await saveToFirestore({
            ideas,
            params
          });

          toast({
            title: "Products Designed & Saved",
            description: "Your merchandise designs have been generated and saved successfully.",
          });
          return ideas;
        } catch (error) {
          logger.error("Detailed error designing products:", {
            message: error.message,
            stack: error.stack,
          });
          toast({
            title: "Error",
            description: error.message || "Failed to design products. Please try again.",
            variant: "destructive",
          });
          throw error;
        }
      },
    },
    {
      name: "Analyze trends",
      description: "Identify trends in music merchandise",
      parameters: [
        {
          name: "market",
          type: "select",
          label: "Target Market",
          description: "Main market to analyze",
          options: [
            { value: "global", label: "Global" },
            { value: "local", label: "Local" },
            { value: "regional", label: "Regional" },
          ],
          defaultValue: "global",
        },
      ],
      action: async (params) => {
        if (!user) {
          toast({
            title: "Authentication Required",
            description: "Please log in to use the Merchandise Designer AI.",
            variant: "destructive",
          });
          return;
        }
        try {
          const prompt = `Analyze current trends in music merchandise for the ${params.market} market.
          Provide insights and recommendations.`;
          const response = await openRouterService.chatWithAgent(
            prompt,
            "merchandise",
            user.uid,
            "You are a market analyst specializing in music merchandise trends."
          );
          setResult(response);
          toast({
            title: "Trends Analyzed",
            description: "Merchandise trend analysis completed successfully.",
          });
          return response;
        } catch (error) {
          logger.error("Detailed error analyzing trends:", {
            message: error.message,
            stack: error.stack,
          });
          toast({
            title: "Error",
            description: error.message || "Failed to analyze trends. Please try again.",
            variant: "destructive",
          });
          throw error;
        }
      },
    },
    {
      name: "Optimize pricing",
      description: "Suggest competitive pricing strategies",
      parameters: [
        {
          name: "priceRange",
          type: "select",
          label: "Price Range",
          description: "Target price range",
          options: [
            { value: "budget", label: "Budget" },
            { value: "mid", label: "Mid-range" },
            { value: "premium", label: "Premium" },
          ],
          defaultValue: "mid",
        },
      ],
      action: async (params) => {
        if (!user) {
          toast({
            title: "Authentication Required",
            description: "Please log in to use the Merchandise Designer AI.",
            variant: "destructive",
          });
          return;
        }
        try {
          const prompt = `Suggest competitive pricing strategies for music merchandise in the ${params.priceRange} range.
          Provide a detailed pricing plan.`;
          const response = await openRouterService.chatWithAgent(
            prompt,
            "merchandise",
            user.uid,
            "You are a pricing strategist specializing in music merchandise."
          );
          setResult(response);
          toast({
            title: "Pricing Optimized",
            description: "Pricing strategies have been generated successfully.",
          });
          return response;
        } catch (error) {
          logger.error("Detailed error optimizing prices:", {
            message: error.message,
            stack: error.stack,
          });
          toast({
            title: "Error",
            description: error.message || "Failed to optimize prices. Please try again.",
            variant: "destructive",
          });
          throw error;
        }
      },
    },
  ];

  return (
    <BaseAgent
      name="Merchandise Designer AI"
      description="Your expert in merchandise design and management"
      icon={ShoppingBag}
      actions={actions}
      theme={theme}
      helpText="Hey there! I'm your Creative Designer for merchandise. I specialize in creating unique products that connect with your fans and reflect your artistic identity. Together, we'll create merch your followers will love! 🎨"
    >
      {result && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">Generated Result:</h3>
          <pre className="whitespace-pre-wrap text-sm">{result}</pre>
        </div>
      )}
    </BaseAgent>
  );
}