# WorkerAgent

**Type:** Ephemeral (Self-Destructing)

## Overview

WorkerAgent is an ephemeral agent designed to execute a single task and then self-destruct. It's ideal for isolated, independent computations that should not persist after completion.

## Responsibilities

- Accept and process a single task
- Execute specific computations in isolation
- Report results to a coordinator agent
- Clean up resources and self-destruct after completion
- Track task execution status and timing

## Lifecycle

1. **Spawned** - Created by a fleet manager or external system
2. **Initialize** - Sets up ephemeral state
3. **Execute Task** - Processes the assigned task via `processTask()`
4. **Report Results** - Sends results to coordinator
5. **Cleanup** - Releases resources
6. **Self-Destruct** - Calls `state.reset()` to mark for garbage collection

## Callable Methods

### `executeTask(task: Task<TTaskData>): Promise<TaskResult<TTaskResult>>`

Executes a task with full lifecycle management.

**Parameters:**
- `task` - Task object containing:
  - `id` - Unique task identifier
  - `type` - Task type/category
  - `data` - Task-specific data payload
  - `priority` - Optional priority level
  - `timeout` - Optional timeout in milliseconds
  - `retries` - Optional retry count

**Returns:** TaskResult containing:
- `taskId` - The task ID
- `success` - Whether the task succeeded
- `result` - The processing result (if successful)
- `error` - Error message (if failed)
- `duration` - Execution time in milliseconds
- `timestamp` - Completion timestamp

**Example:**
```typescript
const task: Task<ImageProcessingData> = {
  id: "task-123",
  type: "resize-image",
  data: {
    url: "https://example.com/image.jpg",
    width: 800,
    height: 600
  },
  priority: 5
};

const result = await worker.executeTask(task);
console.log(`Task ${result.taskId}: ${result.success ? 'Success' : 'Failed'}`);
```

### `getStatus(): Promise<{ status, taskId?, duration? }>`

Returns the current worker status.

**Returns:**
- `status` - Current state: "idle", "processing", "completed", or "failed"
- `taskId` - ID of the task being processed (if any)
- `duration` - Time elapsed since task started (if processing)

**Example:**
```typescript
const status = await worker.getStatus();
if (status.status === "processing") {
  console.log(`Processing task ${status.taskId} for ${status.duration}ms`);
}
```

### `performSelfDestruct(): Promise<void>`

Manually trigger self-destruction (usually called automatically).

**Example:**
```typescript
await worker.performSelfDestruct();
// Worker is now marked for garbage collection
```

## Protected Methods (For Subclasses)

### `abstract processTask(task: Task<TTaskData>): Promise<TTaskResult>`

**Must be implemented by subclasses.** Contains the core task processing logic.

**Example Implementation:**
```typescript
class ImageWorker extends WorkerAgent<Env, WorkerAgentState, ImageTask, ProcessedImage> {
  protected async processTask(task: Task<ImageTask>): Promise<ProcessedImage> {
    // Download image
    const response = await fetch(task.data.url);
    const buffer = await response.arrayBuffer();

    // Process image
    const processed = await this.resizeImage(buffer, task.data.width, task.data.height);

    // Upload result
    const resultUrl = await this.uploadImage(processed);

    return {
      originalUrl: task.data.url,
      processedUrl: resultUrl,
      dimensions: { width: task.data.width, height: task.data.height }
    };
  }

  private async resizeImage(buffer: ArrayBuffer, width: number, height: number) {
    // Image processing logic
  }

  private async uploadImage(data: ArrayBuffer): Promise<string> {
    // Upload logic
  }
}
```

### `reportResult(result: TaskResult<TTaskResult>): Promise<void>`

Override to customize result reporting (e.g., send to coordinator).

**Example:**
```typescript
protected async reportResult(result: TaskResult<ProcessedImage>): Promise<void> {
  await super.reportResult(result);

  // Send to coordinator
  const coordinator = await getAgentByName(this.env, 'COORDINATOR', 'main');
  await coordinator.submitResult(this.getWorkerId(), result);

  // Send webhook notification
  if (result.success) {
    await fetch('https://api.example.com/webhook', {
      method: 'POST',
      body: JSON.stringify(result)
    });
  }
}
```

## Configuration

### `selfDestructDelayMs`

Set the delay before self-destruction (default: 0 for immediate).

**Example:**
```typescript
class MyWorker extends WorkerAgent {
  protected selfDestructDelayMs = 5000; // 5 second delay for debugging
}
```

## Complete Example

```typescript
import { WorkerAgent, type Task } from 'common-agents';

interface DataProcessingTask {
  sourceUrl: string;
  transformations: string[];
}

interface DataResult {
  outputUrl: string;
  recordsProcessed: number;
  transformationsApplied: string[];
}

class DataWorker extends WorkerAgent<
  Env,
  WorkerAgentState,
  DataProcessingTask,
  DataResult
> {
  protected async processTask(task: Task<DataProcessingTask>): Promise<DataResult> {
    // 1. Fetch data
    const data = await this.fetchData(task.data.sourceUrl);

    // 2. Apply transformations
    let processedData = data;
    for (const transformation of task.data.transformations) {
      processedData = await this.applyTransformation(processedData, transformation);
    }

    // 3. Save result
    const outputUrl = await this.saveData(processedData);

    return {
      outputUrl,
      recordsProcessed: processedData.length,
      transformationsApplied: task.data.transformations
    };
  }

  protected async reportResult(result: TaskResult<DataResult>): Promise<void> {
    // Report to coordinator
    const coordinator = await getAgentByName(this.env, 'COORDINATOR', 'default');
    await coordinator.submitResult(this.getWorkerId(), result);
  }

  private async fetchData(url: string) {
    const response = await fetch(url);
    return response.json();
  }

  private async applyTransformation(data: any[], transformation: string) {
    // Transformation logic
    return data;
  }

  private async saveData(data: any[]): Promise<string> {
    // Save to storage
    return 'https://storage.example.com/output.json';
  }
}
```

## Common Usage Pattern with FleetManager

WorkerAgent is typically spawned by a FleetManagerAgent to process tasks in parallel:

```typescript
// Fleet Manager spawns workers
class DataFleetManager extends FleetManagerAgent {
  protected async getWorkerInstance(workerId: string): Promise<DataWorker> {
    return await getAgentByName(this.env, 'DATA_WORKER', workerId);
  }
}

// Usage
const fleetManager = await getAgentByName(env, 'FLEET_MANAGER', 'default');

const tasks: Task<DataProcessingTask>[] = [
  { id: 'task-1', type: 'process', data: { sourceUrl: 'https://...', transformations: ['clean'] } },
  { id: 'task-2', type: 'process', data: { sourceUrl: 'https://...', transformations: ['filter'] } },
  // ... more tasks
];

const batchId = await fleetManager.submitBatch(tasks);

// Workers are spawned, process tasks, report to coordinator, and self-destruct
const status = await fleetManager.getBatchStatus(batchId);
console.log(`Progress: ${status.progress * 100}%`);
```

## Best Practices

1. **Keep state minimal** - Workers should not persist durable state
2. **Report results before cleanup** - Always send results before self-destructing
3. **Handle errors gracefully** - Catch and report errors in `processTask()`
4. **Close resources in cleanup()** - Override `cleanup()` to close connections, cancel operations
5. **Use for isolated tasks** - Workers should process independent, parallelizable tasks
6. **Don't store references** - After self-destruction, the worker instance is gone

## Error Handling

```typescript
protected async processTask(task: Task<MyTask>): Promise<MyResult> {
  try {
    // Risky operation
    const data = await this.fetchExternalData(task.data.url);
    return this.processData(data);
  } catch (error) {
    // Log error
    this.log(`Task failed: ${error}`, 'error');

    // Re-throw to let executeTask handle it
    throw error;
  }
}

// executeTask() automatically catches errors and creates failure result
```
