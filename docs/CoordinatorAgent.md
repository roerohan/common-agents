# CoordinatorAgent

**Type:** Permanent (Long-Lived)

## Overview

CoordinatorAgent aggregates and manages results from multiple worker agents. It maintains long-term durable state and provides query APIs for retrieving and analyzing results.

## Responsibilities

- Receive and store results from worker agents
- Maintain aggregate statistics (counts, success rates, durations)
- Provide query APIs for retrieving filtered results
- Calculate summary metrics
- Persist results indefinitely (until explicitly cleared)

## Lifecycle

CoordinatorAgent is a permanent agent that:
1. **Initializes** once when first created
2. **Receives results** from workers continuously
3. **Maintains state** across multiple invocations
4. **Never self-destructs** - persists indefinitely

## Callable Methods

### `submitResult(workerId: string, result: TaskResult<TResult>): Promise<void>`

Submit a result from a worker agent.

**Parameters:**
- `workerId` - Unique identifier of the worker submitting the result
- `result` - TaskResult object containing:
  - `taskId` - The task identifier
  - `success` - Whether the task succeeded
  - `result` - The actual result data (if successful)
  - `error` - Error message (if failed)
  - `duration` - Execution time in milliseconds
  - `timestamp` - Completion timestamp

**Example:**
```typescript
const result: TaskResult<ProcessedData> = {
  taskId: 'task-123',
  success: true,
  result: { recordsProcessed: 1000, outputUrl: 'https://...' },
  duration: 2500,
  timestamp: Date.now()
};

await coordinator.submitResult('worker-456', result);
```

### `getResults(filter?: ResultFilter): Promise<ResultEntry<TResult>[]>`

Retrieve results with optional filtering.

**Parameters:**
- `filter` (optional):
  - `workerId` - Filter by specific worker
  - `success` - Filter by success/failure
  - `since` - Only results after this timestamp
  - `limit` - Maximum number of results to return

**Returns:** Array of ResultEntry objects, each containing:
- `workerId` - ID of the worker that submitted it
- `result` - The TaskResult
- `receivedAt` - When the coordinator received it

**Example:**
```typescript
// Get last 10 results
const recent = await coordinator.getResults({ limit: 10 });

// Get all successful results from worker-123
const workerResults = await coordinator.getResults({
  workerId: 'worker-123',
  success: true
});

// Get results from last hour
const hourAgo = Date.now() - (60 * 60 * 1000);
const recentResults = await coordinator.getResults({ since: hourAgo });
```

### `getSuccessfulResults(limit?: number): Promise<TResult[]>`

Get only successful results (unwrapped data, not metadata).

**Example:**
```typescript
const topResults = await coordinator.getSuccessfulResults(5);
topResults.forEach(result => {
  console.log(result.recordsProcessed, result.outputUrl);
});
```

### `getFailedResults(limit?: number): Promise<ResultEntry<TResult>[]>`

Get only failed results with full metadata.

**Example:**
```typescript
const failures = await coordinator.getFailedResults();
failures.forEach(entry => {
  console.log(`Worker ${entry.workerId} failed: ${entry.result.error}`);
});
```

### `getSummary(): Promise<Summary>`

Get aggregate statistics about all results.

**Returns:**
- `totalResults` - Total number of results received
- `successCount` - Number of successful results
- `failureCount` - Number of failed results
- `averageDuration` - Average task execution time (ms)
- `oldestResult` - Timestamp of oldest result
- `newestResult` - Timestamp of newest result

**Example:**
```typescript
const summary = await coordinator.getSummary();
console.log(`
  Total: ${summary.totalResults}
  Success Rate: ${(summary.successCount / summary.totalResults * 100).toFixed(2)}%
  Avg Duration: ${summary.averageDuration}ms
`);
```

### `getResultsByWorker(workerId: string): Promise<ResultEntry<TResult>[]>`

Get all results from a specific worker.

**Example:**
```typescript
const workerResults = await coordinator.getResultsByWorker('worker-789');
console.log(`Worker 789 completed ${workerResults.length} tasks`);
```

### `getRecentResults(sinceMs: number): Promise<ResultEntry<TResult>[]>`

Get results from the last N milliseconds.

**Example:**
```typescript
// Results from last 5 minutes
const recentResults = await coordinator.getRecentResults(5 * 60 * 1000);
```

### `getCount(): Promise<number>`

Get total number of results stored.

**Example:**
```typescript
const count = await coordinator.getCount();
console.log(`Coordinator has ${count} results`);
```

### `getSuccessRate(): Promise<number>`

Get success rate as a percentage (0-100).

**Example:**
```typescript
const successRate = await coordinator.getSuccessRate();
console.log(`Success rate: ${successRate.toFixed(2)}%`);
```

### `clear(): Promise<void>`

Clear all results and reset statistics.

**Example:**
```typescript
await coordinator.clear();
console.log('All results cleared');
```

## Complete Example

```typescript
import { CoordinatorAgent, type TaskResult } from 'common-agents';

interface DataProcessingResult {
  sourceUrl: string;
  recordsProcessed: number;
  outputUrl: string;
  transformationsApplied: string[];
}

class DataCoordinator extends CoordinatorAgent<
  Env,
  CoordinatorAgentState,
  DataProcessingResult
> {
  // Optional: Add custom processing when results are submitted
  override async submitResult(
    workerId: string,
    result: TaskResult<DataProcessingResult>
  ): Promise<void> {
    // Call parent implementation
    await super.submitResult(workerId, result);

    // Custom logic: Send notification for failures
    if (!result.success) {
      await this.notifyFailure(workerId, result);
    }

    // Custom logic: Track processed records
    if (result.success && result.result) {
      await this.updateRecordStats(result.result.recordsProcessed);
    }
  }

  // Custom method: Get total records processed
  @callable()
  async getTotalRecordsProcessed(): Promise<number> {
    const results = await this.getSuccessfulResults();
    return results.reduce((sum, r) => sum + r.recordsProcessed, 0);
  }

  // Custom method: Get results by transformation type
  @callable()
  async getResultsByTransformation(transformation: string): Promise<DataProcessingResult[]> {
    const allResults = await this.getSuccessfulResults();
    return allResults.filter(r =>
      r.transformationsApplied.includes(transformation)
    );
  }

  private async notifyFailure(workerId: string, result: TaskResult<DataProcessingResult>) {
    // Send alert
    await fetch('https://api.example.com/alerts', {
      method: 'POST',
      body: JSON.stringify({
        workerId,
        taskId: result.taskId,
        error: result.error,
        timestamp: result.timestamp
      })
    });
  }

  private async updateRecordStats(count: number) {
    this.updateMetadata({
      totalRecordsProcessed: ((this.state.metadata?.totalRecordsProcessed as number) || 0) + count
    });
  }
}
```

## Common Usage Pattern with Workers and FleetManager

```typescript
// 1. Create coordinator
const coordinator = await getAgentByName(env, 'COORDINATOR', 'default');

// 2. Workers submit results as they complete
class DataWorker extends WorkerAgent {
  protected async reportResult(result: TaskResult<DataProcessingResult>): Promise<void> {
    const coordinator = await getAgentByName(this.env, 'COORDINATOR', 'default');
    await coordinator.submitResult(this.getWorkerId(), result);
  }
}

// 3. Query coordinator for aggregated data
const summary = await coordinator.getSummary();
console.log(`Processed ${summary.totalResults} tasks`);
console.log(`Success rate: ${await coordinator.getSuccessRate()}%`);

// Get recent failures
const failures = await coordinator.getFailedResults(10);
failures.forEach(f => {
  console.log(`Task ${f.result.taskId} failed: ${f.result.error}`);
});

// Get specific worker's results
const workerResults = await coordinator.getResultsByWorker('worker-123');
console.log(`Worker 123 completed ${workerResults.length} tasks`);
```

## Integration with FleetManager

FleetManager orchestrates workers that report to the coordinator:

```typescript
// Fleet manager configuration
class DataFleetManager extends FleetManagerAgent {
  constructor() {
    super();
    // Workers will automatically report to coordinator
  }

  protected async getWorkerInstance(workerId: string) {
    return await getAgentByName(this.env, 'DATA_WORKER', workerId);
  }
}

// Workflow
const fleetManager = await getAgentByName(env, 'FLEET_MANAGER', 'default');
const coordinator = await getAgentByName(env, 'COORDINATOR', 'default');

// Submit batch
const batchId = await fleetManager.submitBatch(tasks);

// Poll for completion
while (true) {
  const status = await fleetManager.getBatchStatus(batchId);
  if (status.status === 'completed' || status.status === 'failed') {
    break;
  }
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// Get aggregated results from coordinator
const summary = await coordinator.getSummary();
const results = await coordinator.getSuccessfulResults();
```

## Custom Aggregation Example

```typescript
class AnalyticsCoordinator extends CoordinatorAgent<Env, CoordinatorAgentState, AnalyticsResult> {
  // Calculate hourly statistics
  @callable()
  async getHourlyStats(): Promise<Record<string, { count: number; avgDuration: number }>> {
    const results = await this.getResults();
    const hourlyData: Record<string, { total: number; duration: number; count: number }> = {};

    for (const entry of results) {
      const hour = new Date(entry.receivedAt).toISOString().slice(0, 13); // YYYY-MM-DDTHH

      if (!hourlyData[hour]) {
        hourlyData[hour] = { total: 0, duration: 0, count: 0 };
      }

      hourlyData[hour].count++;
      hourlyData[hour].duration += entry.result.duration;
    }

    const stats: Record<string, { count: number; avgDuration: number }> = {};
    for (const [hour, data] of Object.entries(hourlyData)) {
      stats[hour] = {
        count: data.count,
        avgDuration: data.duration / data.count
      };
    }

    return stats;
  }

  // Get top performers
  @callable()
  async getTopWorkers(limit: number = 10): Promise<Array<{ workerId: string; count: number }>> {
    const results = await this.getResults({ success: true });
    const workerCounts = new Map<string, number>();

    for (const entry of results) {
      workerCounts.set(entry.workerId, (workerCounts.get(entry.workerId) || 0) + 1);
    }

    return Array.from(workerCounts.entries())
      .map(([workerId, count]) => ({ workerId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}
```

## Best Practices

1. **Use filters efficiently** - Apply filters to reduce data transfer
2. **Clear old results periodically** - Prevent unbounded state growth
3. **Add custom aggregations** - Extend with domain-specific analytics
4. **Monitor success rates** - Use `getSuccessRate()` for health checks
5. **Handle failures** - Override `submitResult()` to trigger alerts
6. **Use metadata** - Store additional context with results
7. **Index by time** - Use `getRecentResults()` for time-based queries

## Performance Considerations

- Results are stored in durable state (persistent)
- Large result sets may impact read performance
- Consider clearing old results or archiving them externally
- Use `limit` parameter to reduce data transfer
- Filter server-side rather than client-side when possible
