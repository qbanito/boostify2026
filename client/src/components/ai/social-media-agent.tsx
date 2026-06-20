// src/components/ai/social-media-agent.tsx
import { logger } from "@/lib/logger";

import { Share2 } from "lucide-react";
import { BaseAgent, type AgentAction, type AgentTheme, type AgentResponse } from "./base-agent";
import { useState } from "react";
import { ActionCards, type ToolResultData } from "./action-cards";
import { useAgentExecution } from "../../hooks/use-agent-execution";
import { useAuth } from "../../hooks/use-auth";
import { useToast } from "../../hooks/use-toast";

export function SocialMediaAgent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [result, setResult] = useState<string | null>(null);
  const [toolResults, setToolResults] = useState<ToolResultData[]>([]);

  const { execute } = useAgentExecution({ agentType: 'social-media' });

  const theme: AgentTheme = {
    gradient: "from-pink-500 to-rose-600",
    iconColor: "text-white",
    accentColor: "#EC4899",
    personality: "📱 Digital Influencer",
  };

  const runExecute = async (prompt: string): Promise<AgentResponse> => {
    setResult(null);
    setToolResults([]);
    const data = await execute(prompt);
    if (data) {
      setResult(data.text);
      setToolResults(data.toolResults || []);
    }
    return {
      response: data?.text || '',
      toolResults: data?.toolResults || [],
    };
  };

  const actions: AgentAction[] = [
    {
      name: "Create content calendar",
      description: "Generate a full content calendar saved to your account",
      parameters: [
        {
          name: "platforms",
          type: "select",
          label: "Platforms",
          description: "Main platforms for content",
          options: [
            { value: "instagram", label: "Instagram" },
            { value: "tiktok", label: "TikTok" },
            { value: "youtube", label: "YouTube" },
            { value: "all", label: "All platforms" },
          ],
          defaultValue: "all",
        },
        {
          name: "postsPerWeek",
          type: "number",
          label: "Posts per week",
          description: "How many posts per week per platform",
          defaultValue: "3",
        },
      ],
      action: async (params): Promise<AgentResponse> => {
        if (!user) {
          toast({ title: "Authentication Required", description: "Please log in.", variant: "destructive" });
          return { response: '' };
        }

        const platforms = params.platforms === 'all' ? 'instagram, tiktok, youtube' : params.platforms;
        return runExecute(
          `Create a content calendar for ${platforms} with ${params.postsPerWeek} posts per week.
Use create_content_calendar to save it. Include themes like: behind-the-scenes, new music teasers, fan engagement, collaborations, and personal stories.`
        );
      },
    },
    {
      name: "Generate post pack",
      description: "Create ready-to-publish posts with copy and visual descriptions",
      parameters: [
        {
          name: "platform",
          type: "select",
          label: "Platform",
          description: "Target platform",
          options: [
            { value: "instagram", label: "Instagram" },
            { value: "tiktok", label: "TikTok" },
            { value: "twitter", label: "Twitter/X" },
          ],
          defaultValue: "instagram",
        },
        {
          name: "tone",
          type: "select",
          label: "Tone",
          description: "Content tone",
          options: [
            { value: "casual", label: "Casual" },
            { value: "professional", label: "Professional" },
            { value: "fun", label: "Fun & Playful" },
            { value: "inspiring", label: "Inspiring" },
            { value: "provocative", label: "Provocative" },
          ],
          defaultValue: "casual",
        },
        {
          name: "count",
          type: "number",
          label: "Number of posts",
          description: "How many posts (max 10)",
          defaultValue: "5",
        },
      ],
      action: async (params): Promise<AgentResponse> => {
        if (!user) {
          toast({ title: "Authentication Required", description: "Please log in.", variant: "destructive" });
          return { response: '' };
        }

        const count = Math.min(Number(params.count) || 5, 10);
        return runExecute(
          `Generate ${count} ${params.tone} posts for ${params.platform} about music promotion.
Use generate_post_pack to save the pack. Each post should include: caption text, hashtags, visual description, and best posting time.`
        );
      },
    },
    {
      name: "Hashtag strategy",
      description: "Generate an optimized hashtag strategy for your genre",
      parameters: [
        {
          name: "genre",
          type: "select",
          label: "Music Genre",
          description: "Main genre of your music",
          options: [
            { value: "pop", label: "Pop" },
            { value: "rock", label: "Rock" },
            { value: "hiphop", label: "Hip Hop" },
            { value: "electronic", label: "Electronic" },
            { value: "latin", label: "Latin" },
            { value: "reggaeton", label: "Reggaeton" },
            { value: "r&b", label: "R&B" },
          ],
          defaultValue: "pop",
        },
        {
          name: "platform",
          type: "select",
          label: "Platform",
          description: "Target platform",
          options: [
            { value: "instagram", label: "Instagram" },
            { value: "tiktok", label: "TikTok" },
            { value: "twitter", label: "Twitter/X" },
            { value: "youtube", label: "YouTube" },
          ],
          defaultValue: "instagram",
        },
      ],
      action: async (params): Promise<AgentResponse> => {
        if (!user) {
          toast({ title: "Authentication Required", description: "Please log in.", variant: "destructive" });
          return { response: '' };
        }

        return runExecute(
          `Generate a complete hashtag strategy for ${params.genre} music on ${params.platform}.
Use generate_hashtag_strategy to save it. Include:
- 5 primary high-reach hashtags
- 10 medium-reach engagement hashtags
- 5 niche community hashtags
- Tips on how to use them effectively`
        );
      },
    },
  ];

  return (
    <BaseAgent
      name="Social Media AI"
      description="Your social media expert — creates real calendars, posts, and strategies"
      icon={Share2}
      actions={actions}
      theme={theme}
      helpText="I create ACTUAL content that gets saved to your account. Calendars, post packs, and hashtag strategies — all saved and ready to use. Not just text, but real actionable plans you can execute."
    >
      {result && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">Result:</h3>
          <pre className="whitespace-pre-wrap text-sm">{result}</pre>
        </div>
      )}
      {toolResults.length > 0 && (
        <ActionCards toolResults={toolResults} />
      )}
    </BaseAgent>
  );
}