# FleetManagerAgent

**Type:** Permanent (Long-Lived)

## Overview

FleetManagerAgent dynamically spawns and manages pools of worker agents. It handles task distribution, concurrency control, retry logic, and result aggregation across multiple workers.

## Responsibilities

- Create worker instances on demand
- Distribute tasks to workers with concurrency limits
- Track batch processing status and progress
- Implement retry logic for failed tasks
- Scale worker pools dynamically
- Monitor worker health and performance
- Collect and aggregate batch results

## Lifecycle

FleetManagerAgent is a permanent agent that:
1. **Initializes** with configuration (max workers, timeouts, retries)
2. **Receives batch submissions** continuously
3. **Spawns workers** to process tasks
4. **Manages concurrency** across multiple batches
5. **Maintains state** indefinitely

## Callable Methods

### `submitBatch(tasks: Array<Task<TTaskData>>): Promise<string>`

Submit a batch of tasks for processing.

**Parameters:**
- `tasks` - Array of Task objects to process

**Returns:** Batch ID for tracking

**Example:**
```typescript
const tasks: Task<ImageTask>[] = [
  { id: 'task-1', type: 'resize', data: { url: 'https://...', width: 800 } },
  { id: 'task-2', type: 'resize', data: { url: 'https://...', width: 1024 } },
  { id: 'task-3', type: 'resize', data: { url: 'https://...', width: 640 } },
];

const batchId = await fleetManager.submitBatch(tasks);
console.log(`Batch submitted: ${batchId}`);
```

### `getBatchStatus(batchId: string): Promise<BatchStatus>`

Get current status of a batch.

**Returns:**
- `status` - "pending", "processing", "completed", "failed", or "partial"
- `totalTasks` - Total number of tasks in batch
- `completedTasks` - Number of successfully completed tasks
- `failedTasks` - Number of failed tasks
- `progress` - Completion progress (0-1)

**Example:**
```typescript
const status = await fleetManager.getBatchStatus(batchId);
console.log(`Progress: ${(status.progress * 100).toFixed(2)}%`);
console.log(`Completed: ${status.completedTasks}/${status.totalTasks}`);
console.log(`Failed: ${status.failedTasks}`);
```

### `getBatchResults(batchId: string): Promise<Array<TaskResult<TTaskResult>>>`

Get all results for a batch.

**Example:**
```typescript
const results = await fleetManager.getBatchResults(batchId);
const successful = results.filter(r => r.success);
const failed = results.filter(r => !r.success);

console.log(`Successful: ${successful.length}`);
console.log(`Failed: ${failed.length}`);
```

### `cancelBatch(batchId: string): Promise<boolean>`

Cancel a pending or processing batch.

**Returns:** `true` if cancelled, `false` if batch not found or already completed

**Example:**
```typescript
const cancelled = await fleetManager.cancelBatch(batchId);
if (cancelled) {
  console.log('Batch cancelled successfully');
}
```

### `scaleWorkers(count: number): Promise<void>`

Adjust maximum concurrent workers.

**Parameters:**
- `count` - New maximum concurrent worker count (minimum 1)

**Example:**
```typescript
// Scale up for high load
await fleetManager.scaleWorkers(20);

// Scale down to save resources
await fleetManager.scaleWorkers(5);
```

### `getStats(): Promise<FleetStatistics>`

Get fleet-wide statistics.

**Returns:**
- `totalBatches` - Total batches processed
- `totalTasks` - Total tasks processed
- `completedTasks` - Successfully completed tasks
- `failedTasks` - Failed tasks
- `activeWorkers` - Currently active workers

**Example:**
```typescript
const stats = await fleetManager.getStats();
console.log(`
  Active Workers: ${stats.activeWorkers}
  Total Tasks: ${stats.totalTasks}
  Completed: ${stats.completedTasks}
  Failed: ${stats.failedTasks}
  Success Rate: ${(stats.completedTasks / stats.totalTasks * 100).toFixed(2)}%
`);
```

### `getActiveWorkers(): Promise<WorkerInfo[]>`

Get information about currently active workers.

**Returns:** Array of WorkerInfo objects:
- `id` - Worker ID
- `taskId` - Task being processed
- `status` - "spawning", "active", "completed", or "failed"
- `spawnedAt` - When the worker was created
- `completedAt` - When the worker finished (if completed)

**Example:**
```typescript
const activeWorkers = await fleetManager.getActiveWorkers();
console.log(`${activeWorkers.length} workers currently active`);
activeWorkers.forEach(w => {
  const duration = Date.now() - w.spawnedAt;
  console.log(`Worker ${w.id}: processing ${w.taskId} for ${duration}ms`);
});
```

### `updateConfig(config: Partial<FleetManagerConfig>): Promise<void>`

Update fleet manager configuration.

**Parameters:**
- `maxConcurrentWorkers` - Maximum concurrent workers
- `workerTimeout` - Timeout for worker execution (ms)
- `retryFailedTasks` - Whether to retry failed tasks
- `maxRetries` - Maximum retry attempts

**Example:**
```typescript
await fleetManager.updateConfig({
  maxConcurrentWorkers: 15,
  workerTimeout: 600000, // 10 minutes
  retryFailedTasks: true,
  maxRetries: 2
});
```

## Protected Methods (For Subclasses)

### `abstract getWorkerInstance(workerId: string): Promise<WorkerAgent>`

**Must be implemented by subclasses.** Returns a worker agent instance.

**Example:**
```typescript
class ImageFleetManager extends FleetManagerAgent<
  Env,
  FleetManagerAgentState,
  ImageTask,
  ProcessedImage
> {
  protected async getWorkerInstance(workerId: string): Promise<ImageWorker> {
    return await getAgentByName(this.env, 'IMAGE_WORKER', workerId);
  }
}
```

### `executeTaskOnWorker(worker: any, task: Task): Promise<TaskResult>`

Override to customize how tasks are executed on workers.

**Example:**
```typescript
protected async executeTaskOnWorker(
  worker: ImageWorker,
  task: Task<ImageTask>
): Promise<TaskResult<ProcessedImage>> {
  // Add custom timeout logic
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Worker timeout')), this.state.config.workerTimeout)
  );

  return Promise.race([
    worker.executeTask(task),
    timeoutPromise
  ]);
}
```

## Complete Example

```typescript
import { FleetManagerAgent, getAgentByName } from 'common-agents';

interface DataTask {
  sourceUrl: string;
  transformations: string[];
}

interface DataResult {
  outputUrl: string;
  recordsProcessed: number;
}

class DataFleetManager extends FleetManagerAgent<
  Env,
  FleetManagerAgentState,
  DataTask,
  DataResult
> {
  constructor() {
    super();
    // Initialize with custom config
    this.setState({
      ...this.state,
      config: {
        maxConcurrentWorkers: 10,
        workerTimeout: 300000, // 5 minutes
        retryFailedTasks: true,
        maxRetries: 3
      }
    });
  }

  protected async getWorkerInstance(workerId: string) {
    return await getAgentByName(this.env, 'DATA_WORKER', workerId);
  }

  // Optional: Custom error handling
  protected async executeTaskOnWorker(
    worker: any,
    task: Task<DataTask>
  ): Promise<TaskResult<DataResult>> {
    try {
      return await worker.executeTask(task);
    } catch (error) {
      // Log to external monitoring
      await this.logError(task.id, error);
      throw error;
    }
  }

  private async logError(taskId: string, error: unknown) {
    await fetch('https://api.example.com/errors', {
      method: 'POST',
      body: JSON.stringify({
        taskId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      })
    });
  }
}
```

## Common Usage Pattern

```typescript
// 1. Get fleet manager instance
const fleetManager = await getAgentByName(env, 'FLEET_MANAGER', 'default');

// 2. Prepare tasks
const tasks: Task<DataTask>[] = [
  {
    id: generateTaskId(),
    type: 'process',
    data: {
      sourceUrl: 'https://data.example.com/file1.json',
      transformations: ['clean', 'validate']
    },
    priority: 10
  },
  // ... more tasks
];

// 3. Submit batch
const batchId = await fleetManager.submitBatch(tasks);

// 4. Poll for completion
let status;
do {
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  status = await fleetManager.getBatchStatus(batchId);
  console.log(`Progress: ${(status.progress * 100).toFixed(2)}%`);
} while (status.status === 'processing' || status.status === 'pending');

// 5. Get results
if (status.status === 'completed' || status.status === 'partial') {
  const results = await fleetManager.getBatchResults(batchId);
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);

  // Process successful results
  for (const result of successful) {
    console.log(`Task ${result.taskId}: ${result.result?.recordsProcessed} records`);
  }

  // Handle failures
  for (const result of failed) {
    console.error(`Task ${result.taskId} failed: ${result.error}`);
  }
}
```

## Integration with Coordinator

Fleet Manager + Workers + Coordinator pattern:

```typescript
// Workers report to coordinator
class DataWorker extends WorkerAgent {
  protected async reportResult(result: TaskResult<DataResult>): Promise<void> {
    const coordinator = await getAgentByName(this.env, 'COORDINATOR', 'default');
    await coordinator.submitResult(this.getWorkerId(), result);
  }
}

// Query coordinator for aggregated analytics
const coordinator = await getAgentByName(env, 'COORDINATOR', 'default');
const summary = await coordinator.getSummary();
console.log(`
  Total Results: ${summary.totalResults}
  Success Rate: ${(summary.successCount / summary.totalResults * 100).toFixed(2)}%
  Avg Duration: ${summary.averageDuration}ms
`);
```

## Dynamic Scaling Example

```typescript
class AutoScalingFleetManager extends FleetManagerAgent {
  @callable()
  async autoScale(): Promise<void> {
    const stats = await this.getStats();
    const activeWorkers = stats.activeWorkers;
    const pendingTasks = this.getPendingTaskCount();

    // Scale up if needed
    if (pendingTasks > activeWorkers * 2) {
      const newCount = Math.min(activeWorkers + 5, 50); // Max 50 workers
      await this.scaleWorkers(newCount);
      this.log(`Scaled up to ${newCount} workers`);
    }
    // Scale down if idle
    else if (activeWorkers > 5 && pendingTasks < activeWorkers * 0.5) {
      const newCount = Math.max(activeWorkers - 3, 5); // Min 5 workers
      await this.scaleWorkers(newCount);
      this.log(`Scaled down to ${newCount} workers`);
    }
  }

  private getPendingTaskCount(): number {
    return Object.values(this.state.batches)
      .filter(b => b.status === 'pending' || b.status === 'processing')
      .reduce((sum, b) => sum + (b.totalTasks - b.completedTasks - b.failedTasks), 0);
  }
}
```

## Best Practices

1. **Set appropriate concurrency limits** - Balance throughput vs resource usage
2. **Enable retries for transient failures** - Configure `retryFailedTasks` and `maxRetries`
3. **Monitor active workers** - Use `getActiveWorkers()` to detect stuck tasks
4. **Scale dynamically** - Adjust `maxConcurrentWorkers` based on load
5. **Set timeouts** - Configure `workerTimeout` to prevent hung workers
6. **Handle partial success** - Check batch status for "partial" completion
7. **Clean up old batches** - Periodically remove completed batch data to prevent state growth
8. **Use priority** - Set task `priority` field for important tasks

## Error Handling and Retries

```typescript
// Automatic retry configuration
await fleetManager.updateConfig({
  retryFailedTasks: true,
  maxRetries: 3 // Retry up to 3 times
});

// Tasks are automatically retried with exponential backoff
// After max retries, task moves to failed state
```

## Performance Considerations

- Workers execute in parallel up to `maxConcurrentWorkers` limit
- Each worker is ephemeral and self-destructs after completion
- Batch state is persisted in durable storage
- Use `scaleWorkers()` to adjust to workload
- Consider setting `workerTimeout` to prevent resource leaks
