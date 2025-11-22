import { BaseAgent, BaseAgentState } from "./BaseAgent";
import { callable } from "agents";
import type { Task, TaskResult } from "./WorkerAgent";
import { generateId, generateBatchId } from "../../utils/id";

/**
 * Batch status
 */
export type BatchStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "partial";

/**
 * Batch information
 */
export interface Batch<TTaskData = unknown> {
  id: string;
  tasks: Array<Task<TTaskData>>;
  status: BatchStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  results: Array<TaskResult>;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  workerIds: string[];
}

/**
 * Worker information
 */
export interface WorkerInfo {
  id: string;
  taskId?: string;
  status: "spawning" | "active" | "completed" | "failed";
  spawnedAt: number;
  completedAt?: number;
}

/**
 * Fleet manager configuration
 */
export interface FleetManagerConfig {
  maxConcurrentWorkers?: number;
  workerTimeout?: number;
  retryFailedTasks?: boolean;
  maxRetries?: number;
}

/**
 * Fleet manager agent state
 */
export interface FleetManagerAgentState extends BaseAgentState {
  batches: Record<string, Batch>;
  workers: Record<string, WorkerInfo>;
  config: FleetManagerConfig;
  stats: {
    totalBatches: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    activeWorkers: number;
  };
}

/**
 * FleetManagerAgent dynamically spawns and manages pools of worker agents.
 *
 * Lifecycle: Permanent (maintains state across multiple batch operations)
 *
 * Responsibilities:
 * - Create worker instances on demand
 * - Assign tasks to workers
 * - Handle sharding and batching
 * - Implement retry logic
 * - Monitor worker health and performance
 * - Scale worker pools up/down
 * - Collect and aggregate results
 *
 * @template TEnv - Environment bindings type
 * @template TState - Agent state type (must extend FleetManagerAgentState)
 * @template TTaskData - Type of task data
 * @template TTaskResult - Type of task result
 *
 * @example
 * ```typescript
 * const manager = new FleetManager(ctx, env);
 * const batchId = await manager.submitBatch(tasks);
 * const status = await manager.getBatchStatus(batchId);
 * const results = await manager.getBatchResults(batchId);
 * ```
 */
export abstract class FleetManagerAgent<
  TEnv = unknown,
  TState extends FleetManagerAgentState = FleetManagerAgentState,
  TTaskData = unknown,
  TTaskResult = unknown
> extends BaseAgent<TEnv, TState> {
  /**
   * Initial state for fleet manager
   */
  initialState: TState = {
    created: Date.now(),
    lastUpdated: Date.now(),
    metadata: {},
    batches: {},
    workers: {},
    config: {
      maxConcurrentWorkers: 10,
      workerTimeout: 300000, // 5 minutes
      retryFailedTasks: true,
      maxRetries: 3,
    },
    stats: {
      totalBatches: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      activeWorkers: 0,
    },
  } as TState;

  /**
   * Override initialize for fleet manager setup
   */
  override initialize(): void {
    super.initialize();
    this.log(`Initialized with config: ${JSON.stringify(this.state.config)}`);
  }

  /**
   * Submit a batch of tasks for processing
   *
   * @param tasks - Array of tasks to process
   * @returns Batch ID
   */
  @callable()
  async submitBatch(tasks: Array<Task<TTaskData>>): Promise<string> {
    const batchId = generateBatchId();
    const now = Date.now();

    // Create batch
    const batch: Batch<TTaskData> = {
      id: batchId,
      tasks,
      status: "pending",
      createdAt: now,
      results: [],
      totalTasks: tasks.length,
      completedTasks: 0,
      failedTasks: 0,
      workerIds: [],
    };

    // Update state
    this.setState({
      ...this.state,
      batches: {
        ...this.state.batches,
        [batchId]: batch,
      },
      stats: {
        ...this.state.stats,
        totalBatches: this.state.stats.totalBatches + 1,
        totalTasks: this.state.stats.totalTasks + tasks.length,
      },
    });

    // Start processing batch
    await this.processBatch(batchId);

    return batchId;
  }

  /**
   * Process a batch by spawning workers
   *
   * @param batchId - The batch ID to process
   */
  protected async processBatch(batchId: string): Promise<void> {
    const batch = this.state.batches[batchId];
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    // Update batch status
    this.updateBatch(batchId, {
      status: "processing",
      startedAt: Date.now(),
    });

    // Process tasks with concurrency limit
    const { maxConcurrentWorkers } = this.state.config;
    const taskQueue = [...(batch.tasks as Task<TTaskData>[])];
    const activeWorkers = new Set<Promise<void>>();

    while (taskQueue.length > 0 || activeWorkers.size > 0) {
      // Spawn workers up to concurrency limit
      while (
        taskQueue.length > 0 &&
        activeWorkers.size < maxConcurrentWorkers!
      ) {
        const task = taskQueue.shift()!;
        const workerPromise = this.spawnWorker(batchId, task).finally(() => {
          activeWorkers.delete(workerPromise);
        });
        activeWorkers.add(workerPromise);
      }

      // Wait for at least one worker to complete
      if (activeWorkers.size > 0) {
        await Promise.race(activeWorkers);
      }
    }

    // Mark batch as completed
    this.finalizeBatch(batchId);
  }

  /**
   * Spawn a worker to process a task
   *
   * @param batchId - The batch ID
   * @param task - The task to process
   */
  protected async spawnWorker(
    batchId: string,
    task: Task<TTaskData>
  ): Promise<void> {
    const workerId = generateId(`worker-${task.type}`);
    const now = Date.now();

    // Register worker
    this.registerWorker(workerId, task.id, "spawning");

    try {
      // Get worker instance (must be implemented by subclass)
      const worker = await this.getWorkerInstance(workerId);

      // Update worker status
      this.updateWorkerStatus(workerId, "active");

      // Execute task on worker
      const result = await this.executeTaskOnWorker(worker, task);

      // Record result
      this.recordTaskResult(batchId, workerId, result);

      // Update worker status
      this.updateWorkerStatus(workerId, "completed", now);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Record failure
      const failureResult: TaskResult<TTaskResult> = {
        taskId: task.id,
        success: false,
        error: errorMessage,
        duration: Date.now() - now,
        timestamp: Date.now(),
      };

      this.recordTaskResult(batchId, workerId, failureResult);

      // Update worker status
      this.updateWorkerStatus(workerId, "failed", now);

      // Retry if configured
      if (
        this.state.config.retryFailedTasks &&
        (task.retries || 0) < this.state.config.maxRetries!
      ) {
        const retryTask: Task<TTaskData> = {
          ...task,
          retries: (task.retries || 0) + 1,
        };

        // Re-queue task
        const batch = this.state.batches[batchId];
        if (batch) {
          this.updateBatch(batchId, {
            tasks: [...(batch.tasks as Task<TTaskData>[]), retryTask],
            totalTasks: batch.totalTasks + 1,
          });
        }
      }
    }
  }

  /**
   * Get a worker instance - must be implemented by subclass
   *
   * @param workerId - The worker ID
   * @returns Worker agent instance
   */
  protected abstract getWorkerInstance(workerId: string): Promise<any>;

  /**
   * Execute task on worker - can be overridden by subclass
   *
   * @param worker - The worker instance
   * @param task - The task to execute
   * @returns Task result
   */
  protected async executeTaskOnWorker(
    worker: any,
    task: Task<TTaskData>
  ): Promise<TaskResult<TTaskResult>> {
    // Default implementation - subclasses may override
    return await worker.executeTask(task);
  }

  /**
   * Register a worker
   */
  protected registerWorker(
    workerId: string,
    taskId: string,
    status: WorkerInfo["status"]
  ): void {
    const workerInfo: WorkerInfo = {
      id: workerId,
      taskId,
      status,
      spawnedAt: Date.now(),
    };

    this.setState({
      ...this.state,
      workers: {
        ...this.state.workers,
        [workerId]: workerInfo,
      },
      stats: {
        ...this.state.stats,
        activeWorkers: this.state.stats.activeWorkers + 1,
      },
    });
  }

  /**
   * Update worker status
   */
  protected updateWorkerStatus(
    workerId: string,
    status: WorkerInfo["status"],
    completedAt?: number
  ): void {
    const worker = this.state.workers[workerId];
    if (!worker) return;

    const updatedWorker = {
      ...worker,
      status,
      completedAt,
    };

    const activeWorkerDelta =
      status === "completed" || status === "failed" ? -1 : 0;

    this.setState({
      ...this.state,
      workers: {
        ...this.state.workers,
        [workerId]: updatedWorker,
      },
      stats: {
        ...this.state.stats,
        activeWorkers: this.state.stats.activeWorkers + activeWorkerDelta,
      },
    });
  }

  /**
   * Record task result
   */
  protected recordTaskResult(
    batchId: string,
    workerId: string,
    result: TaskResult<TTaskResult>
  ): void {
    const batch = this.state.batches[batchId];
    if (!batch) return;

    const completedDelta = result.success ? 1 : 0;
    const failedDelta = result.success ? 0 : 1;

    this.updateBatch(batchId, {
      results: [...batch.results, result],
      completedTasks: batch.completedTasks + completedDelta,
      failedTasks: batch.failedTasks + failedDelta,
      workerIds: [...new Set([...batch.workerIds, workerId])],
    });

    // Update global stats
    this.setState({
      ...this.state,
      stats: {
        ...this.state.stats,
        completedTasks: this.state.stats.completedTasks + completedDelta,
        failedTasks: this.state.stats.failedTasks + failedDelta,
      },
    });
  }

  /**
   * Update batch properties
   */
  protected updateBatch(
    batchId: string,
    updates: Partial<Batch<TTaskData>>
  ): void {
    const batch = this.state.batches[batchId];
    if (!batch) return;

    this.setState({
      ...this.state,
      batches: {
        ...this.state.batches,
        [batchId]: {
          ...batch,
          ...updates,
        },
      },
    });
  }

  /**
   * Finalize batch after all tasks complete
   */
  protected finalizeBatch(batchId: string): void {
    const batch = this.state.batches[batchId];
    if (!batch) return;

    const allTasksProcessed =
      batch.completedTasks + batch.failedTasks >= batch.totalTasks;

    if (allTasksProcessed) {
      const status: BatchStatus =
        batch.failedTasks === 0
          ? "completed"
          : batch.completedTasks === 0
            ? "failed"
            : "partial";

      this.updateBatch(batchId, {
        status,
        completedAt: Date.now(),
      });

      this.log(
        `Batch ${batchId} finalized: ${batch.completedTasks}/${batch.totalTasks} succeeded, ${batch.failedTasks} failed`
      );
    }
  }

  /**
   * Get batch status
   *
   * @param batchId - The batch ID
   * @returns Batch status information
   */
  @callable()
  async getBatchStatus(batchId: string): Promise<{
    status: BatchStatus;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    progress: number;
  }> {
    const batch = this.state.batches[batchId];
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const progress =
      batch.totalTasks > 0
        ? (batch.completedTasks + batch.failedTasks) / batch.totalTasks
        : 0;

    return {
      status: batch.status,
      totalTasks: batch.totalTasks,
      completedTasks: batch.completedTasks,
      failedTasks: batch.failedTasks,
      progress,
    };
  }

  /**
   * Get batch results
   *
   * @param batchId - The batch ID
   * @returns Array of task results
   */
  @callable()
  async getBatchResults(batchId: string): Promise<Array<TaskResult<TTaskResult>>> {
    const batch = this.state.batches[batchId];
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    return batch.results as Array<TaskResult<TTaskResult>>;
  }

  /**
   * Cancel a batch
   *
   * @param batchId - The batch ID to cancel
   * @returns true if cancelled successfully
   */
  @callable()
  async cancelBatch(batchId: string): Promise<boolean> {
    const batch = this.state.batches[batchId];
    if (!batch) {
      return false;
    }

    if (batch.status === "completed" || batch.status === "failed") {
      return false; // Cannot cancel already finished batch
    }

    this.updateBatch(batchId, {
      status: "failed",
      completedAt: Date.now(),
    });

    return true;
  }

  /**
   * Scale workers - adjust max concurrent workers
   *
   * @param count - New max concurrent worker count
   */
  @callable()
  async scaleWorkers(count: number): Promise<void> {
    if (count < 1) {
      throw new Error("Worker count must be at least 1");
    }

    this.setState({
      ...this.state,
      config: {
        ...this.state.config,
        maxConcurrentWorkers: count,
      },
    });

    this.log(`Scaled max concurrent workers to ${count}`);
  }

  /**
   * Get fleet statistics
   *
   * @returns Current fleet statistics
   */
  @callable()
  async getStats(): Promise<FleetManagerAgentState["stats"]> {
    return this.state.stats;
  }

  /**
   * Get active workers
   *
   * @returns Array of active worker info
   */
  @callable()
  async getActiveWorkers(): Promise<WorkerInfo[]> {
    return Object.values(this.state.workers).filter(
      (w) => w.status === "active" || w.status === "spawning"
    );
  }

  /**
   * Update configuration
   *
   * @param config - Partial configuration to update
   */
  @callable()
  async updateConfig(config: Partial<FleetManagerConfig>): Promise<void> {
    this.setState({
      ...this.state,
      config: {
        ...this.state.config,
        ...config,
      },
    });

    this.log(`Config updated: ${JSON.stringify(this.state.config)}`);
  }
}
