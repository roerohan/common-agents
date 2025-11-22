import { BaseAgent, BaseAgentState } from "./BaseAgent";
import { callable } from "agents";
import type { Task, TaskResult } from "./WorkerAgent";

/**
 * Task progress
 */
export interface TaskProgress {
  taskId: string;
  status: "pending" | "processing" | "paused" | "completed" | "failed";
  progress: number; // 0-1
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  startedAt?: number;
  estimatedCompletion?: number;
}

/**
 * Complex task (multi-step)
 */
export interface ComplexTask<T = unknown> extends Task<T> {
  steps?: string[];
  pausable?: boolean;
  resumable?: boolean;
}

/**
 * Processing result
 */
export interface ProcessingResult<T = unknown> extends TaskResult<T> {
  progress: TaskProgress;
  intermediateResults?: unknown[];
}

/**
 * Task processor agent state
 */
export interface TaskProcessorAgentState extends BaseAgentState {
  currentTask?: ComplexTask;
  progress?: TaskProgress;
  intermediateResults: unknown[];
}

/**
 * TaskProcessorAgent processes complex, multi-step tasks.
 *
 * Lifecycle: Ephemeral (but may persist longer than simple workers)
 *
 * Responsibilities:
 * - Accept complex task configurations
 * - Perform multi-step processing
 * - Handle errors and partial results
 * - Support pause/resume semantics
 * - Self-destruct after completion or timeout
 *
 * @template TEnv - Environment bindings type
 * @template TState - Agent state type
 * @template TTaskData - Type of task data
 * @template TResult - Type of result
 */
export class TaskProcessorAgent<
  TEnv = unknown,
  TState extends TaskProcessorAgentState = TaskProcessorAgentState,
  TTaskData = unknown,
  TResult = unknown
> extends BaseAgent<TEnv, TState> {
  override initialState: TState = {
    created: Date.now(),
    lastUpdated: Date.now(),
    metadata: {},
    intermediateResults: [],
  } as unknown as TState;

  @callable()
  async processTask(task: ComplexTask<TTaskData>): Promise<ProcessingResult<TResult>> {
    const startTime = Date.now();

    // Initialize progress
    const progress: TaskProgress = {
      taskId: task.id,
      status: "processing",
      progress: 0,
      totalSteps: task.steps?.length,
      completedSteps: 0,
      startedAt: startTime,
    };

    this.setState({
      ...this.state,
      currentTask: task,
      progress,
      intermediateResults: [],
    });

    this.log(`Processing task: ${task.id}`);

    try {
      const result = await this.executeTask(task);

      // Update progress
      progress.status = "completed";
      progress.progress = 1.0;
      progress.completedSteps = progress.totalSteps;

      this.setState({
        ...this.state,
        progress,
      });

      this.log("Task completed successfully, self-destructing");
      await this.selfDestruct();

      return {
        taskId: task.id,
        success: true,
        result,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        progress,
        intermediateResults: this.state.intermediateResults,
      };
    } catch (error) {
      progress.status = "failed";

      this.setState({
        ...this.state,
        progress,
      });

      this.log("Task failed, self-destructing");
      await this.selfDestruct();

      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        progress,
      };
    }
  }

  @callable()
  async getProgress(): Promise<TaskProgress | undefined> {
    return this.state.progress;
  }

  @callable()
  async pause(): Promise<void> {
    if (this.state.progress) {
      this.setState({
        ...this.state,
        progress: {
          ...this.state.progress,
          status: "paused",
        },
      });
      this.log("Task paused");
    }
  }

  @callable()
  async resume(): Promise<void> {
    if (this.state.progress) {
      this.setState({
        ...this.state,
        progress: {
          ...this.state.progress,
          status: "processing",
        },
      });
      this.log("Task resumed");
    }
  }

  protected async executeTask(_task: ComplexTask<TTaskData>): Promise<TResult> {
    // Override in subclasses
    throw new Error("executeTask must be implemented by subclass");
  }

  protected updateProgress(step: string, completedSteps: number, totalSteps: number): void {
    if (this.state.progress) {
      const progress = completedSteps / totalSteps;

      this.setState({
        ...this.state,
        progress: {
          ...this.state.progress,
          currentStep: step,
          completedSteps,
          progress,
        },
      });
    }
  }

  protected saveIntermediateResult(result: unknown): void {
    this.setState({
      ...this.state,
      intermediateResults: [...this.state.intermediateResults, result],
    });
  }
}
