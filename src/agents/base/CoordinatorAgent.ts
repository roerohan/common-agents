import { BaseAgent, BaseAgentState } from "./BaseAgent";
import { callable } from "agents";
import type { TaskResult } from "./WorkerAgent";

/**
 * Result entry with metadata
 */
export interface ResultEntry<TResult = unknown> {
  workerId: string;
  result: TaskResult<TResult>;
  receivedAt: number;
}

/**
 * Summary statistics
 */
export interface Summary {
  totalResults: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  oldestResult?: number;
  newestResult?: number;
}

/**
 * Result filter options
 */
export interface ResultFilter {
  workerId?: string;
  success?: boolean;
  taskType?: string;
  since?: number;
  limit?: number;
}

/**
 * Coordinator agent state
 */
export interface CoordinatorAgentState extends BaseAgentState {
  results: ResultEntry[];
  summary: Summary;
}

/**
 * CoordinatorAgent aggregates results from multiple workers.
 *
 * Lifecycle: Permanent (maintains results indefinitely)
 *
 * Responsibilities:
 * - Receive and store results from workers
 * - Maintain aggregate statistics (counts, summaries, metrics)
 * - Expose query methods for retrieving results
 * - Persist long-term data
 *
 * @template TEnv - Environment bindings type
 * @template TState - Agent state type (must extend CoordinatorAgentState)
 * @template TResult - Type of result data
 *
 * @example
 * ```typescript
 * class ResultsCoordinator extends CoordinatorAgent<Env, CoordinatorAgentState, MyResult> {
 *   // Optional: Add custom processing
 *   override async submitResult(workerId: string, result: TaskResult<MyResult>): Promise<void> {
 *     await super.submitResult(workerId, result);
 *     // Custom logic (notifications, webhooks, etc.)
 *   }
 * }
 * ```
 */
export class CoordinatorAgent<
  TEnv = unknown,
  TState extends CoordinatorAgentState = CoordinatorAgentState,
  TResult = unknown
> extends BaseAgent<TEnv, TState> {
  /**
   * Initial state for coordinator
   */
  override initialState: TState = {
    created: Date.now(),
    lastUpdated: Date.now(),
    metadata: {},
    results: [],
    summary: {
      totalResults: 0,
      successCount: 0,
      failureCount: 0,
      averageDuration: 0,
    },
  } as unknown as TState;

  /**
   * Override initialize for coordinator setup
   */
  override initialize(): void {
    super.initialize();
    this.log("Coordinator initialized");
  }

  /**
   * Submit a result from a worker
   *
   * @param workerId - ID of the worker submitting the result
   * @param result - The task result
   */
  @callable()
  async submitResult(
    workerId: string,
    result: TaskResult<TResult>
  ): Promise<void> {
    const now = Date.now();

    const entry: ResultEntry<TResult> = {
      workerId,
      result,
      receivedAt: now,
    };

    // Add result to collection
    const results = [...this.state.results, entry] as ResultEntry<TResult>[];

    // Update summary statistics
    const summary = this.calculateSummary(results);

    this.setState({
      ...this.state,
      results,
      summary,
    });

    this.log(
      `Received result from ${workerId}: ${result.success ? "success" : "failed"}`
    );
  }

  /**
   * Get all results, optionally filtered
   *
   * @param filter - Optional filter criteria
   * @returns Array of result entries
   */
  @callable()
  async getResults(filter?: ResultFilter): Promise<ResultEntry<TResult>[]> {
    let results = this.state.results as ResultEntry<TResult>[];

    // Apply filters
    if (filter) {
      if (filter.workerId) {
        results = results.filter((r) => r.workerId === filter.workerId);
      }

      if (filter.success !== undefined) {
        results = results.filter((r) => r.result.success === filter.success);
      }

      if (filter.since !== undefined) {
        results = results.filter((r) => r.receivedAt >= filter.since!);
      }

      if (filter.limit) {
        results = results.slice(-filter.limit);
      }
    }

    return results;
  }

  /**
   * Get successful results only
   *
   * @param limit - Optional limit on number of results
   * @returns Array of successful results
   */
  @callable()
  async getSuccessfulResults(limit?: number): Promise<TResult[]> {
    const results = await this.getResults({ success: true, limit });
    return results
      .filter((r) => r.result.result !== undefined)
      .map((r) => r.result.result!);
  }

  /**
   * Get failed results only
   *
   * @param limit - Optional limit on number of results
   * @returns Array of failed result entries
   */
  @callable()
  async getFailedResults(limit?: number): Promise<ResultEntry<TResult>[]> {
    return this.getResults({ success: false, limit });
  }

  /**
   * Get summary statistics
   *
   * @returns Summary object
   */
  @callable()
  async getSummary(): Promise<Summary> {
    return this.state.summary;
  }

  /**
   * Get results for a specific worker
   *
   * @param workerId - The worker ID
   * @returns Array of results from that worker
   */
  @callable()
  async getResultsByWorker(workerId: string): Promise<ResultEntry<TResult>[]> {
    return this.getResults({ workerId });
  }

  /**
   * Get recent results
   *
   * @param sinceMs - Milliseconds ago
   * @returns Array of recent results
   */
  @callable()
  async getRecentResults(sinceMs: number): Promise<ResultEntry<TResult>[]> {
    const since = Date.now() - sinceMs;
    return this.getResults({ since });
  }

  /**
   * Clear all results
   */
  @callable()
  async clear(): Promise<void> {
    this.setState({
      ...this.state,
      results: [],
      summary: {
        totalResults: 0,
        successCount: 0,
        failureCount: 0,
        averageDuration: 0,
      },
    });

    this.log("Cleared all results");
  }

  /**
   * Get total result count
   *
   * @returns Total number of results
   */
  @callable()
  async getCount(): Promise<number> {
    return this.state.results.length;
  }

  /**
   * Get success rate
   *
   * @returns Success rate as percentage (0-100)
   */
  @callable()
  async getSuccessRate(): Promise<number> {
    const { totalResults, successCount } = this.state.summary;
    if (totalResults === 0) return 0;
    return (successCount / totalResults) * 100;
  }

  /**
   * Calculate summary statistics from results
   *
   * @param results - Array of result entries
   * @returns Summary object
   */
  protected calculateSummary(results: ResultEntry<TResult>[]): Summary {
    if (results.length === 0) {
      return {
        totalResults: 0,
        successCount: 0,
        failureCount: 0,
        averageDuration: 0,
      };
    }

    const successCount = results.filter((r) => r.result.success).length;
    const failureCount = results.length - successCount;

    const totalDuration = results.reduce(
      (sum, r) => sum + r.result.duration,
      0
    );
    const averageDuration = totalDuration / results.length;

    const timestamps = results.map((r) => r.receivedAt);
    const oldestResult = Math.min(...timestamps);
    const newestResult = Math.max(...timestamps);

    return {
      totalResults: results.length,
      successCount,
      failureCount,
      averageDuration,
      oldestResult,
      newestResult,
    };
  }

  /**
   * Log with coordinator name
   */
  protected log(message: string): void {
    const name = (this.state.metadata?.agentName as string) || "Coordinator";
    console.log(`[${name}] ${message}`);
  }
}
