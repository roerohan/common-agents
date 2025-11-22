import { BaseAgent, BaseAgentState } from "./BaseAgent";
import { callable } from "agents";
import { generateScheduleId } from "../../utils/id";

/**
 * Scheduled task
 */
export interface ScheduledTask<T = unknown> {
  id: string;
  name: string;
  callback: string;
  payload: T;
  scheduleType: "once" | "recurring" | "cron";
  executeAt: number;
  cronExpression?: string;
  interval?: number;
  enabled: boolean;
  lastExecutedAt?: number;
  nextExecuteAt?: number;
  executionCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Scheduler agent state
 */
export interface SchedulerAgentState extends BaseAgentState {
  tasks: Record<string, ScheduledTask>;
  executionHistory: Array<{
    taskId: string;
    executedAt: number;
    success: boolean;
    error?: string;
  }>;
  stats: {
    totalTasks: number;
    activeTasks: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
  };
}

/**
 * SchedulerAgent schedules and executes tasks at specific times or intervals.
 *
 * Lifecycle: Permanent (maintains schedule indefinitely)
 *
 * Responsibilities:
 * - Register scheduled tasks with alarms
 * - Execute tasks at scheduled times
 * - Persist schedule information
 * - Handle recurring tasks and cron-like patterns
 *
 * @template TEnv - Environment bindings type
 * @template TState - Agent state type (must extend SchedulerAgentState)
 *
 * @example
 * ```typescript
 * class MyScheduler extends SchedulerAgent<Env, SchedulerAgentState> {
 *   // Add custom scheduled task handlers
 *   async myScheduledTask(payload: any): Promise<void> {
 *     // Task implementation
 *   }
 * }
 * ```
 */
export class SchedulerAgent<
  TEnv = unknown,
  TState extends SchedulerAgentState = SchedulerAgentState
> extends BaseAgent<TEnv, TState> {
  /**
   * Initial state for scheduler
   */
  override initialState: TState = {
    created: Date.now(),
    lastUpdated: Date.now(),
    metadata: {},
    tasks: {},
    executionHistory: [],
    stats: {
      totalTasks: 0,
      activeTasks: 0,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
    },
  } as unknown as TState;

  /**
   * Override initialize for scheduler setup
   */
  override initialize(): void {
    super.initialize();
    this.log(`Initialized with ${Object.keys(this.state.tasks).length} scheduled tasks`);

    // Schedule next alarm if there are tasks
    this.scheduleNextAlarm();
  }

  /**
   * Schedule a one-time task
   *
   * @param name - Task name
   * @param callback - Method name to call
   * @param executeAt - When to execute (timestamp or Date)
   * @param payload - Data to pass to callback
   * @returns Task ID
   */
  @callable()
  async scheduleTask<T = unknown>(
    name: string,
    callback: string,
    executeAt: number | Date,
    payload?: T
  ): Promise<string> {
    const taskId = generateScheduleId();
    const executeTime = typeof executeAt === "number" ? executeAt : executeAt.getTime();

    const task: ScheduledTask = {
      id: taskId,
      name,
      callback,
      payload: payload as unknown,
      scheduleType: "once",
      executeAt: executeTime,
      enabled: true,
      executionCount: 0,
      nextExecuteAt: executeTime,
    };

    this.setState({
      ...this.state,
      tasks: {
        ...this.state.tasks,
        [taskId]: task,
      },
      stats: {
        ...this.state.stats,
        totalTasks: this.state.stats.totalTasks + 1,
        activeTasks: this.state.stats.activeTasks + 1,
      },
    });

    this.log(`Scheduled task: ${name} (${taskId}) at ${new Date(executeTime).toISOString()}`);

    // Update alarm
    this.scheduleNextAlarm();

    return taskId;
  }

  /**
   * Schedule a recurring task
   *
   * @param name - Task name
   * @param callback - Method name to call
   * @param intervalMs - Interval in milliseconds
   * @param payload - Data to pass to callback
   * @returns Task ID
   */
  @callable()
  async scheduleRecurringTask<T = unknown>(
    name: string,
    callback: string,
    intervalMs: number,
    payload?: T
  ): Promise<string> {
    const taskId = generateScheduleId();
    const now = Date.now();
    const nextExecuteAt = now + intervalMs;

    const task: ScheduledTask = {
      id: taskId,
      name,
      callback,
      payload: payload as unknown,
      scheduleType: "recurring",
      executeAt: nextExecuteAt,
      interval: intervalMs,
      enabled: true,
      executionCount: 0,
      nextExecuteAt,
    };

    this.setState({
      ...this.state,
      tasks: {
        ...this.state.tasks,
        [taskId]: task,
      },
      stats: {
        ...this.state.stats,
        totalTasks: this.state.stats.totalTasks + 1,
        activeTasks: this.state.stats.activeTasks + 1,
      },
    });

    this.log(`Scheduled recurring task: ${name} (${taskId}) every ${intervalMs}ms`);

    // Update alarm
    this.scheduleNextAlarm();

    return taskId;
  }

  /**
   * Cancel a scheduled task
   *
   * @param taskId - The task ID to cancel
   * @returns true if cancelled, false if not found
   */
  @callable()
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.state.tasks[taskId];
    if (!task) {
      return false;
    }

    const { [taskId]: removed, ...remaining } = this.state.tasks;

    this.setState({
      ...this.state,
      tasks: remaining,
      stats: {
        ...this.state.stats,
        activeTasks: this.state.stats.activeTasks - 1,
      },
    });

    this.log(`Cancelled task: ${task.name} (${taskId})`);

    // Update alarm
    this.scheduleNextAlarm();

    return true;
  }

  /**
   * Get all scheduled tasks
   *
   * @returns Array of scheduled tasks
   */
  @callable()
  async getScheduledTasks(): Promise<ScheduledTask[]> {
    return Object.values(this.state.tasks);
  }

  /**
   * Get a specific task
   *
   * @param taskId - The task ID
   * @returns The task or undefined
   */
  @callable()
  async getTask(taskId: string): Promise<ScheduledTask | undefined> {
    return this.state.tasks[taskId];
  }

  /**
   * Enable or disable a task
   *
   * @param taskId - The task ID
   * @param enabled - Whether to enable or disable
   * @returns true if updated, false if not found
   */
  @callable()
  async setTaskEnabled(taskId: string, enabled: boolean): Promise<boolean> {
    const task = this.state.tasks[taskId];
    if (!task) {
      return false;
    }

    this.setState({
      ...this.state,
      tasks: {
        ...this.state.tasks,
        [taskId]: {
          ...task,
          enabled,
        },
      },
    });

    this.log(`${enabled ? "Enabled" : "Disabled"} task: ${task.name} (${taskId})`);

    // Update alarm
    this.scheduleNextAlarm();

    return true;
  }

  /**
   * Get execution history
   *
   * @param limit - Optional limit on number of entries
   * @returns Execution history
   */
  @callable()
  async getExecutionHistory(limit?: number): Promise<SchedulerAgentState["executionHistory"]> {
    const history = this.state.executionHistory;
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get statistics
   *
   * @returns Scheduler statistics
   */
  @callable()
  async getStats(): Promise<SchedulerAgentState["stats"]> {
    return this.state.stats;
  }

  /**
   * Execute a specific task immediately
   *
   * @param taskId - The task ID to execute
   */
  @callable()
  async executeTask(taskId: string): Promise<void> {
    const task = this.state.tasks[taskId];
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    await this.executeScheduledTask(task);
  }

  /**
   * Alarm handler - executes due tasks
   */
  override alarm = async (): Promise<void> => {
    this.log("Alarm triggered, checking for due tasks");

    const now = Date.now();
    const dueTasks = Object.values(this.state.tasks).filter(
      (task) => task.enabled && task.nextExecuteAt && task.nextExecuteAt <= now
    );

    if (dueTasks.length === 0) {
      this.log("No due tasks found");
      this.scheduleNextAlarm();
      return;
    }

    this.log(`Executing ${dueTasks.length} due tasks`);

    // Execute all due tasks
    for (const task of dueTasks) {
      await this.executeScheduledTask(task);
    }

    // Schedule next alarm
    this.scheduleNextAlarm();
  };

  /**
   * Execute a scheduled task
   *
   * @param task - The task to execute
   */
  protected async executeScheduledTask(task: ScheduledTask): Promise<void> {
    const startTime = Date.now();
    this.log(`Executing task: ${task.name} (${task.id})`);

    try {
      // Call the callback method
      const method = (this as any)[task.callback];
      if (typeof method === "function") {
        await method.call(this, task.payload);
      } else {
        throw new Error(`Callback method ${task.callback} not found`);
      }

      // Record success
      this.recordExecution(task.id, true);

      // Update task
      this.updateTaskAfterExecution(task, true);

      this.log(`Task completed: ${task.name} in ${Date.now() - startTime}ms`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Task failed: ${task.name} - ${errorMessage}`, "error");

      // Record failure
      this.recordExecution(task.id, false, errorMessage);

      // Update task
      this.updateTaskAfterExecution(task, false);
    }
  }

  /**
   * Record task execution in history
   */
  protected recordExecution(taskId: string, success: boolean, error?: string): void {
    const executionHistory = [
      ...this.state.executionHistory,
      {
        taskId,
        executedAt: Date.now(),
        success,
        error,
      },
    ];

    // Keep only last 1000 entries
    const trimmedHistory = executionHistory.slice(-1000);

    this.setState({
      ...this.state,
      executionHistory: trimmedHistory,
      stats: {
        ...this.state.stats,
        totalExecutions: this.state.stats.totalExecutions + 1,
        successfulExecutions: success
          ? this.state.stats.successfulExecutions + 1
          : this.state.stats.successfulExecutions,
        failedExecutions: success
          ? this.state.stats.failedExecutions
          : this.state.stats.failedExecutions + 1,
      },
    });
  }

  /**
   * Update task after execution
   */
  protected updateTaskAfterExecution(task: ScheduledTask, _success: boolean): void {
    const now = Date.now();
    const updatedTask = {
      ...task,
      lastExecutedAt: now,
      executionCount: task.executionCount + 1,
    };

    // Calculate next execution time
    if (task.scheduleType === "once") {
      // One-time task - disable it
      updatedTask.enabled = false;
      updatedTask.nextExecuteAt = undefined;
    } else if (task.scheduleType === "recurring" && task.interval) {
      // Recurring task - schedule next execution
      updatedTask.nextExecuteAt = now + task.interval;
      updatedTask.executeAt = updatedTask.nextExecuteAt;
    }

    this.setState({
      ...this.state,
      tasks: {
        ...this.state.tasks,
        [task.id]: updatedTask,
      },
    });
  }

  /**
   * Schedule the next alarm
   */
  protected scheduleNextAlarm(): void {
    const enabledTasks = Object.values(this.state.tasks).filter(
      (task) => task.enabled && task.nextExecuteAt
    );

    if (enabledTasks.length === 0) {
      this.log("No tasks to schedule");
      return;
    }

    // Find earliest task
    const nextTask = enabledTasks.reduce((earliest, task) =>
      task.nextExecuteAt! < earliest.nextExecuteAt! ? task : earliest
    );

    const nextTime = nextTask.nextExecuteAt!;
    this.log(`Next task: ${nextTask.name} at ${new Date(nextTime).toISOString()}`);

    // Schedule alarm using Cloudflare's schedule method
    this.schedule(new Date(nextTime), "alarm", null);
  }
}
