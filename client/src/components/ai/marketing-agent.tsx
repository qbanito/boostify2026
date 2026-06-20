// src/components/ai/marketing-agent.tsx
import { logger } from "@/lib/logger";

import { Megaphone } from "lucide-react";
import { BaseAgent, type AgentAction, type AgentTheme, type AgentResponse } from "./base-agent";
import { useState } from "react";
import { ProgressIndicator } from "./progress-indicator";
import { ActionCards, type ToolResultData } from "./action-cards";
import { useAgentExecution } from "../../hooks/use-agent-execution";
import { useAuth } from "../../hooks/use-auth";
import { useToast } from "../../hooks/use-toast";

interface Step {
  message: string;
  timestamp: Date;
}

export function MarketingAgent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isThinking, setIsThinking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [toolResults, setToolResults] = useState<ToolResultData[]>([]);

  const { execute } = useAgentExecution({ agentType: 'marketing' });

  const theme: AgentTheme = {
    gradient: "from-green-500 to-emerald-700",
    iconColor: "text-white",
    accentColor: "#10B981",
    personality: "💼 Digital Strategist",
  };

  const runWithProgress = async (fn: () => Promise<any>, progressSteps: string[]) => {
    setIsThinking(true);
    setProgress(0);
    setSteps([]);
    setResult(null);
    setToolResults([]);

    for (let i = 0; i < progressSteps.length; i++) {
      setSteps((prev) => [...prev, { message: progressSteps[i], timestamp: new Date() }]);
      setProgress((i + 1) * (80 / progressSteps.length));
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    try {
      const res = await fn();
      setProgress(100);
      return res;
    } finally {
      setIsThinking(false);
    }
  };

  const actions: AgentAction[] = [
    {
      name: "Create marketing campaign",
      description: "Create a full campaign with timeline, milestones, and scheduled posts — saved automatically",
      parameters: [
        {
          name: "target",
          type: "select",
          label: "Target Audience",
          description: "Select the main target audience for the campaign",
          options: [
            { value: "gen-z", label: "Generation Z (13-25)" },
            { value: "millennials", label: "Millennials (26-40)" },
            { value: "gen-x", label: "Generation X (41-55)" },
            { value: "broad", label: "General Audience" },
          ],
          defaultValue: "millennials",
        },
        {
          name: "budget",
          type: "number",
          label: "Budget ($)",
          description: "Monthly budget for the marketing campaign",
          defaultValue: "1000",
        },
        {
          name: "platform",
          type: "select",
          label: "Main Platform",
          description: "Primary platform for the campaign",
          options: [
            { value: "instagram", label: "Instagram" },
            { value: "tiktok", label: "TikTok" },
            { value: "youtube", label: "YouTube" },
            { value: "spotify", label: "Spotify" },
            { value: "all", label: "All platforms" },
          ],
          defaultValue: "instagram",
        },
      ],
      action: async (params): Promise<AgentResponse> => {
        if (!user) {
          toast({ title: "Authentication Required", description: "Please log in.", variant: "destructive" });
          return { response: '' };
        }

        const data = await runWithProgress(
          () => execute(
            `Create a complete marketing campaign for a music artist.
Target audience: ${params.target}
Monthly budget: $${params.budget}
Main platform: ${params.platform}
Goal: Music promotion and audience growth.

Use the create_campaign tool to save the campaign, and schedule_social_post for the first 3 posts of the campaign. Also analyze the audience.`
          ),
          [
            "Analyzing target audience with AI...",
            "Creating campaign structure...",
            "Scheduling initial posts...",
            "Analyzing audience insights...",
          ]
        );

        if (data) {
          setResult(data.text);
          setToolResults(data.toolResults || []);
        }

        return {
          response: data?.text || '',
          toolResults: data?.toolResults || [],
        };
      },
    },
    {
      name: "Schedule content batch",
      description: "Plan and schedule a batch of posts across platforms",
      parameters: [
        {
          name: "contentType",
          type: "select",
          label: "Content Type",
          description: "Main type of content to schedule",
          options: [
            { value: "posts", label: "Regular Posts" },
            { value: "stories", label: "Stories" },
            { value: "reels", label: "Reels/Short Videos" },
            { value: "mixed", label: "Mixed Content" },
          ],
          defaultValue: "mixed",
        },
        {
          name: "platform",
          type: "select",
          label: "Platform",
          description: "Target platform",
          options: [
            { value: "instagram", label: "Instagram" },
            { value: "tiktok", label: "TikTok" },
            { value: "youtube", label: "YouTube" },
            { value: "twitter", label: "Twitter/X" },
          ],
          defaultValue: "instagram",
        },
      ],
      action: async (params): Promise<AgentResponse> => {
        if (!user) {
          toast({ title: "Authentication Required", description: "Please log in.", variant: "destructive" });
          return { response: '' };
        }

        const data = await runWithProgress(
          () => execute(
            `Schedule a batch of ${params.contentType} content for ${params.platform} over the next 2 weeks.
Create 5 posts, each scheduled for a different day. Use schedule_social_post to save each one.
Make the content engaging, platform-optimized, and related to music promotion.`
          ),
          [
            "Planning content strategy...",
            "Generating post copy...",
            "Scheduling posts...",
          ]
        );

        if (data) {
          setResult(data.text);
          setToolResults(data.toolResults || []);
        }

        return {
          response: data?.text || '',
          toolResults: data?.toolResults || [],
        };
      },
    },
    {
      name: "Analyze audience",
      description: "Analyze audience demographics and engagement to optimize strategy",
      parameters: [
        {
          name: "timeframe",
          type: "select",
          label: "Analysis Period",
          description: "Time period to analyze",
          options: [
            { value: "7d", label: "Last 7 days" },
            { value: "30d", label: "Last 30 days" },
            { value: "90d", label: "Last 90 days" },
            { value: "1y", label: "Last year" },
          ],
          defaultValue: "30d",
        },
      ],
      action: async (params): Promise<AgentResponse> => {
        if (!user) {
          toast({ title: "Authentication Required", description: "Please log in.", variant: "destructive" });
          return { response: '' };
        }

        const data = await runWithProgress(
          () => execute(
            `Analyze my audience for the period ${params.timeframe}. 
Use analyze_audience to get the data, then provide actionable insights about demographics, peak engagement times, and content recommendations.`
          ),
          [
            "Gathering audience data...",
            "Analyzing demographics...",
            "Generating insights...",
          ]
        );

        if (data) {
          setResult(data.text);
          setToolResults(data.toolResults || []);
        }

        return {
          response: data?.text || '',
          toolResults: data?.toolResults || [],
        };
      },
    },
  ];

  return (
    <BaseAgent
      name="Strategic Marketing AI"
      description="Your expert in digital strategies and growth — now with real actions"
      icon={Megaphone}
      actions={actions}
      theme={theme}
      helpText="I create REAL campaigns that get saved to your account. I can schedule posts, analyze your audience, and build complete marketing strategies — not just text, but actual executable plans."
    >
      {(isThinking || steps.length > 0) && (
        <ProgressIndicator
          steps={steps}
          progress={progress}
          isThinking={isThinking}
          isComplete={progress === 100}
        />
      )}
      {result && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">Strategy:</h3>
          <pre className="whitespace-pre-wrap text-sm">{result}</pre>
        </div>
      )}
      {toolResults.length > 0 && (
        <ActionCards toolResults={toolResults} />
      )}
    </BaseAgent>
  );
}