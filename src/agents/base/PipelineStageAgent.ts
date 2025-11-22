import { BaseAgent, BaseAgentState } from "./BaseAgent";
import { callable } from "agents";

export interface StageInput<T = unknown> {
  data: T;
  metadata?: Record<string, unknown>;
  previousStage?: string;
}

export interface StageOutput<T = unknown> {
  data: T;
  metadata?: Record<string, unknown>;
  nextStage?: string;
}

export interface StageMetadata {
  stageName: string;
  stageNumber: number;
  totalStages?: number;
  description?: string;
}

export interface PipelineStageAgentState extends BaseAgentState {
  stageMetadata: StageMetadata;
  processedCount: number;
  failedCount: number;
}

export class PipelineStageAgent<
  TEnv = unknown,
  TState extends PipelineStageAgentState = PipelineStageAgentState,
  TInput = unknown,
  TOutput = unknown
> extends BaseAgent<TEnv, TState> {
  override initialState: TState = {
    created: Date.now(),
    lastUpdated: Date.now(),
    metadata: {},
    stageMetadata: {
      stageName: "UnnamedStage",
      stageNumber: 1,
    },
    processedCount: 0,
    failedCount: 0,
  } as unknown as TState;

  @callable()
  async processStage(input: StageInput<TInput>): Promise<StageOutput<TOutput>> {
    this.log(`Processing input from ${input.previousStage || "start"}`);

    try {
      const output = await this.transform(input);

      this.setState({
        ...this.state,
        processedCount: this.state.processedCount + 1,
      });

      this.log("Stage processing completed, self-destructing");
      await this.selfDestruct();

      return output;
    } catch (error) {
      this.setState({
        ...this.state,
        failedCount: this.state.failedCount + 1,
      });

      this.log(`Stage processing failed: ${error}`, "error");
      await this.selfDestruct();

      throw error;
    }
  }

  @callable()
  async getStageInfo(): Promise<StageMetadata> {
    return this.state.stageMetadata;
  }

  @callable()
  async getStats(): Promise<{ processed: number; failed: number }> {
    return {
      processed: this.state.processedCount,
      failed: this.state.failedCount,
    };
  }

  protected async transform(_input: StageInput<TInput>): Promise<StageOutput<TOutput>> {
    throw new Error("transform must be implemented by subclass");
  }

  protected setStageMetadata(metadata: Partial<StageMetadata>): void {
    this.setState({
      ...this.state,
      stageMetadata: {
        ...this.state.stageMetadata,
        ...metadata,
      },
    });
  }
}
