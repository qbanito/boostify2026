/**
 * OpenAI Agents SDK - Workflow Runner
 * Classifies user intent then routes to the right specialist agent.
 * Keeps conversation history for multi-turn chat.
 */
import { Runner, withTrace } from "@openai/agents";
import { configureAgentsSDK } from "./client";
import {
  classificationAgent,
  agentMap,
  type AgentCategory,
} from "./agents";

// Configure once on first import
configureAgentsSDK();

const MAX_HISTORY_ITEMS = 40;
const AGENT_TIMEOUT_MS = 60_000; // 60s max per agent call

export interface ChatInput {
  message: string;
  conversationHistory?: any[];
  artistId?: number;
  agentOverride?: AgentCategory;
}

export interface ChatOutput {
  response: string;
  agentUsed: string;
  classification: string;
  conversationHistory: any[];
  toolCalls?: Array<{ name: string; input: unknown }>;
}

/** Callback for streaming status updates during agent execution */
export type StreamCallback = (event: StreamEvent) => void;

export type StreamEvent =
  | { type: "status"; phase: "classifying" }
  | { type: "status"; phase: "routing"; agent: string; classification: string }
  | { type: "status"; phase: "thinking"; agent: string }
  | { type: "status"; phase: "tool_call"; tool: string }
  | { type: "done"; data: ChatOutput }
  | { type: "error"; message: string };

function trimHistory(history: any[]): any[] {
  if (history.length <= MAX_HISTORY_ITEMS) return history;
  // Keep first item (system context) + last N items
  return [history[0], ...history.slice(-MAX_HISTORY_ITEMS + 1)];
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
      ms
    );
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

export async function runAgentChat(
  input: ChatInput,
  onStream?: StreamCallback
): Promise<ChatOutput> {
  return await withTrace("boostify-agent-chat", async (): Promise<ChatOutput> => {
    const runner = new Runner();

    // Build conversation history
    let history: any[] = input.conversationHistory
      ? [...input.conversationHistory]
      : [];

    history.push({
      role: "user",
      content: input.message,
    });

    // If artist context, prepend system hint
    if (input.artistId) {
      const hasContext = history.some(
        (h) => typeof h?.content === "string" && h.content.includes("System context")
      );
      if (!hasContext) {
        history.unshift({
          role: "user",
          content: `[System context: The user is currently working with artist ID ${input.artistId}. Use getArtistProfile tool with this ID when you need artist info.]`,
        });
      }
    }

    // Trim history to avoid exceeding token limits
    history = trimHistory(history);

    let classification: AgentCategory;

    if (input.agentOverride) {
      classification = input.agentOverride;
    } else {
      // Step 1: Classify intent
      onStream?.({ type: "status", phase: "classifying" });
      const classResult = await withTimeout(
        runner.run(classificationAgent, history),
        15_000,
        "Classification"
      );
      if (!classResult.finalOutput) {
        classification = "general_question";
      } else {
        classification = classResult.finalOutput.classification as AgentCategory;
      }
    }

    // Step 2: Route to specialist
    const agent = agentMap[classification] ?? agentMap.general_question;
    onStream?.({ type: "status", phase: "routing", agent: agent.name, classification });
    onStream?.({ type: "status", phase: "thinking", agent: agent.name });

    const result = await withTimeout(
      runner.run(agent, history),
      AGENT_TIMEOUT_MS,
      agent.name
    );

    const responseText = result.finalOutput
      ? String(result.finalOutput)
      : "I couldn't generate a response. Please try rephrasing your question.";

    // Collect new history items
    const newItems = result.newItems as any[];
    const newHistory: any[] = trimHistory([
      ...history,
      ...newItems.map((item) => item.rawItem),
    ]);

    // Extract tool calls for transparency
    const toolCalls = newItems
      .filter((item) => item.rawItem?.type === "function_call")
      .map((item) => {
        const name = item.rawItem?.name ?? "unknown";
        onStream?.({ type: "status", phase: "tool_call", tool: name });
        return {
          name,
          input: item.rawItem?.arguments ?? {},
        };
      });

    const output: ChatOutput = {
      response: responseText,
      agentUsed: agent.name,
      classification,
      conversationHistory: newHistory,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };

    onStream?.({ type: "done", data: output });

    return output;
  });
}
