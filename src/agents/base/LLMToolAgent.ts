import { BaseAgent, BaseAgentState } from "./BaseAgent";
import { callable } from "agents";

export interface LLMTask {
  prompt: string;
  systemPrompt?: string;
  context?: unknown;
  tools?: LLMTool[];
  maxTokens?: number;
  temperature?: number;
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMTaskResult {
  response: LLMResponse;
  conversationHistory: Array<{ role: string; content: string }>;
}

export interface LLMToolAgentState extends BaseAgentState {
  conversationHistory: Array<{ role: string; content: string }>;
  tools: LLMTool[];
}

export class LLMToolAgent<
  TEnv = unknown,
  TState extends LLMToolAgentState = LLMToolAgentState
> extends BaseAgent<TEnv, TState> {
  override initialState: TState = {
    created: Date.now(),
    lastUpdated: Date.now(),
    metadata: {},
    conversationHistory: [],
    tools: [],
  } as unknown as TState;

  @callable()
  async executePrompt(prompt: string, _context?: unknown): Promise<LLMResponse> {
    const preview = prompt.length > 50 ? prompt.slice(0, 50) + "..." : prompt;
    this.log(`Executing prompt: ${preview}`);

    this.setState({
      ...this.state,
      conversationHistory: [
        ...this.state.conversationHistory,
        { role: "user", content: prompt },
      ],
    });

    const response: LLMResponse = {
      content: "Override executePrompt to call actual LLM API",
    };

    this.setState({
      ...this.state,
      conversationHistory: [
        ...this.state.conversationHistory,
        { role: "assistant", content: response.content },
      ],
    });

    return response;
  }

  @callable()
  async addTool(tool: LLMTool): Promise<void> {
    this.setState({
      ...this.state,
      tools: [...this.state.tools, tool],
    });
    this.log(`Added tool: ${tool.name}`);
  }

  @callable()
  async continueConversation(message: string): Promise<LLMResponse> {
    return this.executePrompt(message);
  }

  @callable()
  async clearHistory(): Promise<void> {
    this.setState({
      ...this.state,
      conversationHistory: [],
    });
    this.log("Cleared conversation history");
  }

  /**
   * Complete the conversation and self-destruct.
   * Call this when the LLM interaction is finished.
   */
  @callable()
  async complete(): Promise<void> {
    this.log("Completing conversation and self-destructing");
    await this.selfDestruct();
  }
}
