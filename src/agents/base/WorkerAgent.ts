import { BaseAgent, BaseAgentState } from "./BaseAgent";
import { callable } from "agents";

/**
 * Task interface for worker agents
 */
export interface Task<TData = unknown> {
  id: string;
  type: string;
  data: TData;
  priority?: number;
  timeout?: number;
  retries?: number;
}

/**
 * Task result interface
 */
export interface TaskResult<TResult = unknown> {
  taskId: string;
  success: boolean;
  result?: TResult;
  error?: string;
  duration: number;
  timestamp: number;
}

/**
 * Worker agent state
 */
export interface WorkerAgentState extends BaseAgentState {
  taskId?: string;
  status: "idle" | "processing" | "completed" | "failed";
  startTime?: number;
  endTime?: number;
  error?: string;
}

/**
 * Coordinator interface for reporting results
 */
export interface ICoordinator {
  submitResult(workerId: string, result: TaskResult): Promise<void>;
}

/**
 * WorkerAgent is an ephemeral agent that executes a single task and self-destructs.
 *
 * Lifecycle: Ephemeral (self-destructs after task completion)
 *
 * Responsibilities:
 * - Accept task configuration
 * - Perform specific computation
 * - Report result to coordinator
 * - Clean up state and terminate
 *
 * @template TEnv - Environment bindings type
 * @template TState - Agent state type (must extend WorkerAgentState)
 * @template TTaskData - Type of task data to process
 * @template TTaskResult - Type of result to return
 *
 * @example
 * ```typescript
 * class ImageWorker extends WorkerAgent<Env, WorkerAgentState, ImageTask, ProcessedImage> {
 *   protected async processTask(task: Task<ImageTask>): Promise<ProcessedImage> {
 *     const image = await downloadImage(task.data.url);
 *     return await processImage(image, task.data.operations);
 *   }
 * }
 * ```
 */
export abstract class WorkerAgent<
  TEnv = unknown,
  TState extends WorkerAgentState = WorkerAgentState,
  TTaskData = unknown,
  TTaskResult = unknown
> extends BaseAgent<TEnv, TState> {
  /**
   * Initial state for worker agents
   */
  initialState: TState = {
    created: Date.now(),
    lastUpdated: Date.now(),
    metadata: {},
    status: "idle",
  } as TState;

  /**
   * How long to wait before self-destructing after task completion (ms)
   * Set to 0 for immediate destruction, or a delay for debugging/result retrieval
   */
  protected selfDestructDelayMs = 0;

  /**
   * Override initialize for worker-specific setup
   */
  override initialize(): void {
    super.initialize();
    this.log(`Spawned at ${new Date().toISOString()}`);
  }

  /**
   * Override cleanup to ensure results are sent before destruction
   */
  override async cleanup(): Promise<void> {
    this.log("Cleaning up resources");

    // Ensure any pending operations are completed
    // Subclasses should override this to add specific cleanup logic
  }

  /**
   * Execute a task with full lifecycle management
   *
   * @param task - The task to execute
   * @returns The task result
   */
  @callable()
  async executeTask(task: Task<TTaskData>): Promise<TaskResult<TTaskResult>> {
    return this.executeWithLifecycle(async () => {
      const startTime = Date.now();

      // Update state to processing
      this.setState({
        ...this.state,
        taskId: task.id,
        status: "processing",
        startTime,
      });

      try {
        // Process the task (implemented by subclass)
        const result = await this.processTask(task);

        const endTime = Date.now();
        const taskResult: TaskResult<TTaskResult> = {
          taskId: task.id,
          success: true,
          result,
          duration: endTime - startTime,
          timestamp: endTime,
        };

        // Update state to completed
        this.setState({
          ...this.state,
          status: "completed",
          endTime,
        });

        // Report to coordinator if configured
        await this.reportResult(taskResult);

        // Schedule self-destruction
        await this.scheduleDestruction();

        return taskResult;
      } catch (error) {
        const endTime = Date.now();
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        const taskResult: TaskResult<TTaskResult> = {
          taskId: task.id,
          success: false,
          error: errorMessage,
          duration: endTime - startTime,
          timestamp: endTime,
        };

        // Update state to failed
        this.setState({
          ...this.state,
          status: "failed",
          endTime,
          error: errorMessage,
        });

        // Report failure to coordinator
        await this.reportResult(taskResult);

        // Schedule self-destruction even on failure
        await this.scheduleDestruction();

        throw error;
      }
    });
  }

  /**
   * Process the task - must be implemented by subclasses
   *
   * @param task - The task to process
   * @returns The processing result
   */
  protected abstract processTask(
    task: Task<TTaskData>
  ): Promise<TTaskResult>;

  /**
   * Report result to coordinator
   * Override this to customize result reporting
   *
   * @param result - The task result to report
   */
  protected async reportResult(result: TaskResult<TTaskResult>): Promise<void> {
    // Default implementation - override in subclasses to report to coordinator
    this.log(
      `Completed task ${result.taskId}: ${result.success ? "success" : "failed"}`
    );

    // Subclasses can access coordinator via environment bindings:
    // const coordinator = await getAgentByName(this.env, 'COORDINATOR', 'coordinator-1');
    // await coordinator.submitResult(this.getWorkerId(), result);
  }

  /**
   * Schedule self-destruction with optional delay
   */
  protected async scheduleDestruction(): Promise<void> {
    if (this.selfDestructDelayMs > 0) {
      // Schedule destruction via alarm
      const destructTime = new Date(Date.now() + this.selfDestructDelayMs);
      await this.schedule(destructTime, "performSelfDestruct", null);
    } else {
      // Immediate destruction
      await this.performSelfDestruct();
    }
  }

  /**
   * Perform self-destruction
   * Can be called directly or via scheduled alarm
   */
  @callable()
  async performSelfDestruct(): Promise<void> {
    this.log("Self-destructing");
    await this.selfDestruct();
  }

  /**
   * Get worker ID from metadata or generate one
   */
  protected getWorkerId(): string {
    return (
      (this.state.metadata?.workerId as string) ||
      this.state.taskId ||
      "unknown"
    );
  }

  /**
   * Get current task status
   */
  @callable()
  async getStatus(): Promise<{
    status: WorkerAgentState["status"];
    taskId?: string;
    duration?: number;
  }> {
    const duration =
      this.state.startTime && this.state.endTime
        ? this.state.endTime - this.state.startTime
        : this.state.startTime
          ? Date.now() - this.state.startTime
          : undefined;

    return {
      status: this.state.status,
      taskId: this.state.taskId,
      duration,
    };
  }
}
