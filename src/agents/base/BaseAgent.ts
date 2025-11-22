import { Agent, type Connection } from "agents";

/**
 * Base agent state interface - all agents should extend this
 */
export interface BaseAgentState {
  created?: number;
  lastUpdated?: number;
  metadata?: Record<string, unknown>;
  agentName?: string;
}

/**
 * BaseAgent provides common functionality for all agents in the framework.
 * Implements the lifecycle model defined in FRAMEWORK.md with standardized hooks.
 *
 * Lifecycle phases:
 * 1. initialize() - Setup state and resources
 * 2. onBeforeTask() - Pre-processing logic
 * 3. [Task execution]
 * 4. onAfterTask() - Post-processing and cleanup
 * 5. cleanup() - Resource deallocation
 * 6. onAlarm() - Scheduled/delayed actions
 *
 * @template TEnv - Environment bindings type
 * @template TState - Agent state type (must extend BaseAgentState)
 */
export abstract class BaseAgent<
  TEnv = unknown,
  TState extends BaseAgentState = BaseAgentState
> extends Agent<TEnv, TState> {
  /**
   * Define the initial state for the agent.
   * Override this in subclasses to provide custom initial state.
   */
  initialState: TState = {
    created: Date.now(),
    lastUpdated: Date.now(),
    metadata: {},
  } as TState;

  /**
   * Initialize the agent state and resources.
   * Called when the agent first starts or resumes.
   * Override this method to add custom initialization logic.
   */
  initialize(): void {
    // Initialize state if it doesn't exist
    if (!this.state.created) {
      this.setState({
        ...this.state,
        created: Date.now(),
        lastUpdated: Date.now(),
      });
    }
  }

  /**
   * Hook called before task execution.
   * Use this for pre-processing logic, validation, or setup.
   * Override in subclasses to add custom pre-task logic.
   */
  onBeforeTask(): void {
    // Default: update timestamp
    this.setState({
      ...this.state,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Hook called after task execution.
   * Use this for post-processing, result handling, or cleanup.
   * Override in subclasses to add custom post-task logic.
   *
   * @param _success - Whether the task completed successfully
   * @param error - Error object if task failed
   */
  onAfterTask(_success: boolean, error?: Error): void {
    // Default: update timestamp
    this.setState({
      ...this.state,
      lastUpdated: Date.now(),
    });

    if (error) {
      console.error("Task failed:", error);
    }
  }

  /**
   * Clean up resources before agent termination or self-destruction.
   * Override this to close connections, cancel operations, release locks, etc.
   * Always called before state.reset() for ephemeral agents.
   */
  async cleanup(): Promise<void> {
    // Default implementation - override in subclasses
    // Close connections, cancel pending operations, release locks, etc.
  }

  /**
   * Lifecycle hook called when the agent starts or resumes from hibernation.
   * Automatically calls initialize() to ensure proper setup.
   */
  override async onStart(): Promise<void> {
    this.initialize();
  }

  /**
   * Lifecycle hook called when state is updated from any source.
   * Override to react to state changes.
   *
   * @param _state - The updated state (or undefined)
   * @param _source - The source of the state update
   */
  override onStateUpdate(
    _state: TState | undefined,
    _source: Connection | "server"
  ): void {
    // Override in subclasses if needed
  }

  /**
   * Alarm handler for scheduled/delayed actions.
   * Override this property to implement scheduled task execution.
   * Use this for periodic operations, delayed cleanup, etc.
   */
  readonly alarm = async (): Promise<void> => {
    // Override in subclasses that need alarm functionality
  };

  /**
   * Helper method to execute a task with lifecycle hooks.
   * Wraps task execution with onBeforeTask/onAfterTask calls.
   *
   * @param taskFn - The task function to execute
   * @returns The result of the task function
   */
  protected async executeWithLifecycle<T>(
    taskFn: () => Promise<T>
  ): Promise<T> {
    this.onBeforeTask();

    try {
      const result = await taskFn();
      this.onAfterTask(true);
      return result;
    } catch (error) {
      this.onAfterTask(false, error as Error);
      throw error;
    }
  }

  /**
   * Helper method for ephemeral agents to self-destruct.
   * Calls cleanup() and then destroys the agent (removes all state and scheduled tasks).
   * Only use this for ephemeral agents - permanent agents should never call this.
   */
  protected async selfDestruct(): Promise<void> {
    this.log("Self-destructing agent", "info");
    await this.cleanup();
    await this.destroy();
  }

  /**
   * Update agent metadata in state.
   *
   * @param metadata - Metadata to merge with existing metadata
   */
  protected updateMetadata(metadata: Record<string, unknown>): void {
    this.setState({
      ...this.state,
      metadata: {
        ...this.state.metadata,
        ...metadata,
      },
      lastUpdated: Date.now(),
    });
  }

  /**
   * Set agent name for logging
   *
   * @param name - The agent name
   */
  protected setAgentName(name: string): void {
    this.setState({
      ...this.state,
      agentName: name,
    });
  }

  /**
   * Get agent name for logging
   */
  protected getAgentName(): string {
    return this.state.agentName || this.constructor.name;
  }

  /**
   * Log a message with agent name prefix
   *
   * @param message - The message to log
   * @param level - Log level (default: 'info')
   */
  protected log(message: string, level: "info" | "warn" | "error" = "info"): void {
    const prefix = `[${this.getAgentName()}]`;

    switch (level) {
      case "warn":
        console.warn(prefix, message);
        break;
      case "error":
        console.error(prefix, message);
        break;
      default:
        console.log(prefix, message);
    }
  }
}

