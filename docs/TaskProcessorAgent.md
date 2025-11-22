# TaskProcessorAgent

**Type:** Ephemeral (Self-Destructing)

## Overview

TaskProcessorAgent processes complex, multi-step tasks with progress tracking and pause/resume capabilities. Unlike simple WorkerAgent, it handles long-running tasks that may span multiple steps and require progress monitoring.

## Responsibilities

- Execute complex multi-step tasks
- Track detailed progress through steps
- Support pause and resume operations
- Store intermediate results
- Report progress in real-time
- Handle partial failures gracefully
- Self-destruct after completion

## Lifecycle

1. **Spawned** - Created for a complex task
2. **Initialize** - Sets up task state
3. **Execute Task** - Processes through multiple steps
4. **Track Progress** - Updates progress state
5. **Complete/Fail** - Finishes processing
6. **Self-Destruct** - Cleans up after completion

## Callable Methods

### `processTask(task: ComplexTask<TTaskData>): Promise<ProcessingResult<TResult>>`

Process a complex multi-step task.

**Parameters:**
- `task` - ComplexTask object containing:
  - `id` - Unique task identifier
  - `type` - Task type/category
  - `data` - Task-specific data
  - `steps` - Optional array of step names
  - `pausable` - Whether task can be paused
  - `resumable` - Whether task can be resumed
  - `priority` - Optional priority level
  - `timeout` - Optional timeout in milliseconds

**Returns:** ProcessingResult containing:
- `taskId` - The task ID
- `success` - Whether task succeeded
- `result` - The processing result (if successful)
- `error` - Error message (if failed)
- `duration` - Execution time in milliseconds
- `timestamp` - Completion timestamp
- `progress` - Detailed progress information
- `intermediateResults` - Results from each step

**Example:**
```typescript
const task: ComplexTask<DataPipelineTask> = {
  id: 'pipeline-123',
  type: 'data-pipeline',
  data: {
    sourceUrl: 'https://data.example.com/dataset.csv',
    transformations: ['clean', 'normalize', 'aggregate'],
    destination: 's3://output/'
  },
  steps: ['download', 'clean', 'normalize', 'aggregate', 'upload'],
  pausable: true,
  resumable: true
};

const result = await processor.processTask(task);

if (result.success) {
  console.log(`Task completed in ${result.duration}ms`);
  console.log(`Final result:`, result.result);
  console.log(`Intermediate results:`, result.intermediateResults);
} else {
  console.error(`Task failed: ${result.error}`);
  console.log(`Progress: ${result.progress.progress * 100}%`);
}
```

### `getProgress(): Promise<TaskProgress | undefined>`

Get current task progress.

**Returns:** TaskProgress containing:
- `taskId` - The task being processed
- `status` - "pending", "processing", "paused", "completed", or "failed"
- `progress` - Progress percentage (0-1)
- `currentStep` - Name of current step
- `totalSteps` - Total number of steps
- `completedSteps` - Number of completed steps
- `startedAt` - When task started
- `estimatedCompletion` - Estimated completion time

**Example:**
```typescript
const progress = await processor.getProgress();
if (progress) {
  console.log(`Status: ${progress.status}`);
  console.log(`Progress: ${(progress.progress * 100).toFixed(2)}%`);
  console.log(`Step: ${progress.currentStep} (${progress.completedSteps}/${progress.totalSteps})`);

  if (progress.estimatedCompletion) {
    const eta = new Date(progress.estimatedCompletion);
    console.log(`ETA: ${eta.toLocaleString()}`);
  }
}
```

### `pause(): Promise<void>`

Pause task execution (if task is pausable).

**Example:**
```typescript
// Pause a running task
await processor.pause();
console.log('Task paused');

// Check status
const progress = await processor.getProgress();
console.log(`Status: ${progress?.status}`); // "paused"
```

### `resume(): Promise<void>`

Resume paused task execution.

**Example:**
```typescript
// Resume a paused task
await processor.resume();
console.log('Task resumed');

// Check status
const progress = await processor.getProgress();
console.log(`Status: ${progress?.status}`); // "processing"
```

## Protected Methods (For Subclasses)

### `abstract executeTask(task: ComplexTask<TTaskData>): Promise<TResult>`

**Must be implemented by subclasses.** Contains the core multi-step processing logic.

**Example Implementation:**
```typescript
class DataPipelineProcessor extends TaskProcessorAgent<
  Env,
  TaskProcessorAgentState,
  PipelineTask,
  PipelineResult
> {
  protected async executeTask(task: ComplexTask<PipelineTask>): Promise<PipelineResult> {
    const steps = task.steps || ['download', 'process', 'upload'];
    const totalSteps = steps.length;
    let currentStep = 0;

    // Step 1: Download
    this.updateProgress('downloading data', currentStep++, totalSteps);
    const data = await this.downloadData(task.data.sourceUrl);
    this.saveIntermediateResult({ step: 'download', recordCount: data.length });

    // Step 2: Process transformations
    let processed = data;
    for (const transformation of task.data.transformations) {
      this.updateProgress(`applying ${transformation}`, currentStep++, totalSteps);

      processed = await this.applyTransformation(processed, transformation);
      this.saveIntermediateResult({
        step: transformation,
        recordCount: processed.length
      });
    }

    // Step 3: Upload
    this.updateProgress('uploading results', currentStep++, totalSteps);
    const outputUrl = await this.uploadResults(processed, task.data.destination);
    this.saveIntermediateResult({ step: 'upload', url: outputUrl });

    return {
      recordsProcessed: processed.length,
      outputUrl,
      transformations: task.data.transformations
    };
  }

  private async downloadData(url: string): Promise<any[]> {
    const response = await fetch(url);
    const csv = await response.text();
    return this.parseCsv(csv);
  }

  private async applyTransformation(data: any[], transformation: string): Promise<any[]> {
    // Apply transformation logic
    return data;
  }

  private async uploadResults(data: any[], destination: string): Promise<string> {
    // Upload logic
    return destination + 'output.json';
  }

  private parseCsv(csv: string): any[] {
    // CSV parsing
    return [];
  }
}
```

### `updateProgress(step: string, completedSteps: number, totalSteps: number): void`

Update task progress information.

**Example:**
```typescript
protected async executeTask(task: ComplexTask<MyTask>): Promise<MyResult> {
  const steps = ['validate', 'process', 'finalize'];

  this.updateProgress(steps[0], 0, steps.length);
  await this.validateInput(task.data);

  this.updateProgress(steps[1], 1, steps.length);
  const result = await this.processData(task.data);

  this.updateProgress(steps[2], 2, steps.length);
  await this.finalizeOutput(result);

  return result;
}
```

### `saveIntermediateResult(result: unknown): void`

Save intermediate results from each step.

**Example:**
```typescript
protected async executeTask(task: ComplexTask<MyTask>): Promise<MyResult> {
  // Step 1
  const parsed = await this.parseInput(task.data);
  this.saveIntermediateResult({ step: 'parse', records: parsed.length });

  // Step 2
  const validated = await this.validateRecords(parsed);
  this.saveIntermediateResult({ step: 'validate', valid: validated.length });

  // Step 3
  const output = await this.generateOutput(validated);
  this.saveIntermediateResult({ step: 'output', size: output.byteLength });

  return { success: true, output };
}
```

## Complete Example

```typescript
import { TaskProcessorAgent, type ComplexTask, type ProcessingResult } from 'common-agents';
import { callable } from 'agents';

interface VideoProcessingTask {
  videoUrl: string;
  operations: Array<'transcode' | 'thumbnail' | 'caption' | 'compress'>;
  outputFormat: string;
  quality: 'low' | 'medium' | 'high';
}

interface VideoProcessingResult {
  outputUrl: string;
  thumbnailUrl?: string;
  captionUrl?: string;
  duration: number;
  size: number;
  format: string;
}

class VideoProcessor extends TaskProcessorAgent<
  Env,
  TaskProcessorAgentState,
  VideoProcessingTask,
  VideoProcessingResult
> {
  protected async executeTask(
    task: ComplexTask<VideoProcessingTask>
  ): Promise<VideoProcessingResult> {
    const { videoUrl, operations, outputFormat, quality } = task.data;
    const totalSteps = operations.length + 2; // +2 for download and upload
    let currentStep = 0;

    // Download video
    this.updateProgress('Downloading video', currentStep++, totalSteps);
    const videoData = await this.downloadVideo(videoUrl);
    this.saveIntermediateResult({
      step: 'download',
      size: videoData.byteLength
    });

    // Process operations
    let processedVideo = videoData;
    let thumbnailUrl: string | undefined;
    let captionUrl: string | undefined;

    for (const operation of operations) {
      this.updateProgress(`Processing: ${operation}`, currentStep++, totalSteps);

      switch (operation) {
        case 'transcode':
          processedVideo = await this.transcode(processedVideo, outputFormat, quality);
          this.saveIntermediateResult({
            step: 'transcode',
            format: outputFormat,
            size: processedVideo.byteLength
          });
          break;

        case 'thumbnail':
          thumbnailUrl = await this.generateThumbnail(processedVideo);
          this.saveIntermediateResult({
            step: 'thumbnail',
            url: thumbnailUrl
          });
          break;

        case 'caption':
          captionUrl = await this.generateCaptions(processedVideo);
          this.saveIntermediateResult({
            step: 'caption',
            url: captionUrl
          });
          break;

        case 'compress':
          processedVideo = await this.compress(processedVideo);
          this.saveIntermediateResult({
            step: 'compress',
            size: processedVideo.byteLength
          });
          break;
      }
    }

    // Upload result
    this.updateProgress('Uploading result', currentStep++, totalSteps);
    const outputUrl = await this.uploadVideo(processedVideo, outputFormat);
    this.saveIntermediateResult({
      step: 'upload',
      url: outputUrl
    });

    return {
      outputUrl,
      thumbnailUrl,
      captionUrl,
      duration: await this.getVideoDuration(processedVideo),
      size: processedVideo.byteLength,
      format: outputFormat
    };
  }

  private async downloadVideo(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    return response.arrayBuffer();
  }

  private async transcode(
    video: ArrayBuffer,
    format: string,
    quality: string
  ): Promise<ArrayBuffer> {
    // Transcoding logic
    this.log(`Transcoding to ${format} at ${quality} quality`);
    return video;
  }

  private async generateThumbnail(video: ArrayBuffer): Promise<string> {
    // Thumbnail generation
    return 'https://cdn.example.com/thumbnail.jpg';
  }

  private async generateCaptions(video: ArrayBuffer): Promise<string> {
    // Caption generation
    return 'https://cdn.example.com/captions.vtt';
  }

  private async compress(video: ArrayBuffer): Promise<ArrayBuffer> {
    // Compression logic
    return video;
  }

  private async uploadVideo(video: ArrayBuffer, format: string): Promise<string> {
    // Upload logic
    return `https://cdn.example.com/output.${format}`;
  }

  private async getVideoDuration(video: ArrayBuffer): Promise<number> {
    // Get duration
    return 120; // seconds
  }
}
```

## Common Usage Pattern

```typescript
// 1. Spawn processor
const processor = await getAgentByName(env, 'VIDEO_PROCESSOR', generateId());

// 2. Define complex task
const task: ComplexTask<VideoProcessingTask> = {
  id: 'video-123',
  type: 'video-processing',
  data: {
    videoUrl: 'https://input.example.com/video.mp4',
    operations: ['transcode', 'thumbnail', 'compress'],
    outputFormat: 'webm',
    quality: 'high'
  },
  steps: ['download', 'transcode', 'thumbnail', 'compress', 'upload'],
  pausable: true,
  resumable: true,
  timeout: 600000 // 10 minutes
};

// 3. Start processing
const resultPromise = processor.processTask(task);

// 4. Monitor progress
const checkProgress = async () => {
  const progress = await processor.getProgress();
  if (progress) {
    console.log(`${progress.currentStep}: ${(progress.progress * 100).toFixed(0)}%`);
  }
};

const progressInterval = setInterval(checkProgress, 2000);

// 5. Wait for completion
const result = await resultPromise;
clearInterval(progressInterval);

// 6. Handle result
if (result.success) {
  console.log('Video processing completed!');
  console.log(`Output: ${result.result?.outputUrl}`);
  console.log(`Thumbnail: ${result.result?.thumbnailUrl}`);
  console.log(`Intermediate results:`, result.intermediateResults);
} else {
  console.error(`Processing failed: ${result.error}`);
  console.log(`Progress at failure: ${result.progress.progress * 100}%`);
}
```

## Pause and Resume Example

```typescript
class ResumableProcessor extends TaskProcessorAgent<
  Env,
  TaskProcessorAgentState,
  LongRunningTask,
  TaskResult
> {
  protected async executeTask(task: ComplexTask<LongRunningTask>): Promise<TaskResult> {
    const checkpoints = task.data.checkpoints || [];

    for (let i = 0; i < checkpoints.length; i++) {
      // Check if paused
      while (this.state.progress?.status === 'paused') {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.updateProgress(`Processing checkpoint ${i}`, i, checkpoints.length);

      const result = await this.processCheckpoint(checkpoints[i]);
      this.saveIntermediateResult({
        checkpoint: i,
        result
      });
    }

    return { completed: true };
  }

  private async processCheckpoint(checkpoint: any): Promise<any> {
    // Process checkpoint
    return checkpoint;
  }
}

// Usage with pause/resume
const processor = await getAgentByName(env, 'PROCESSOR', 'task-1');

// Start task
processor.processTask(task);

// Pause after 5 seconds
setTimeout(async () => {
  await processor.pause();
  console.log('Task paused');

  // Resume after 10 seconds
  setTimeout(async () => {
    await processor.resume();
    console.log('Task resumed');
  }, 10000);
}, 5000);
```

## Integration with Progress Tracking

```typescript
// Progress monitoring service
class ProgressMonitor {
  private intervals = new Map<string, NodeJS.Timeout>();

  async startMonitoring(
    processorId: string,
    callback: (progress: TaskProgress) => void
  ): Promise<void> {
    const interval = setInterval(async () => {
      const processor = await getAgentByName(env, 'PROCESSOR', processorId);
      const progress = await processor.getProgress();

      if (progress) {
        callback(progress);

        // Stop monitoring if completed or failed
        if (progress.status === 'completed' || progress.status === 'failed') {
          this.stopMonitoring(processorId);
        }
      }
    }, 1000);

    this.intervals.set(processorId, interval);
  }

  stopMonitoring(processorId: string): void {
    const interval = this.intervals.get(processorId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(processorId);
    }
  }
}

// Usage
const monitor = new ProgressMonitor();
const processorId = 'processor-123';

monitor.startMonitoring(processorId, (progress) => {
  console.log(`[${progress.taskId}] ${progress.currentStep}: ${(progress.progress * 100).toFixed(0)}%`);

  // Send to UI via WebSocket
  ws.send(JSON.stringify({
    type: 'progress',
    data: progress
  }));
});
```

## Best Practices

1. **Break tasks into steps** - Define clear steps for better progress tracking
2. **Save intermediate results** - Helps with debugging and partial recovery
3. **Update progress frequently** - Provides better user experience
4. **Handle pause gracefully** - Check pause state at step boundaries
5. **Set realistic timeouts** - Allow enough time for complex processing
6. **Clean up resources** - Release memory/connections after each step
7. **Implement checkpointing** - For long-running resumable tasks
8. **Log step transitions** - Aid in troubleshooting failures

## Performance Considerations

- Processors are ephemeral and self-destruct after completion
- Progress updates stored in durable state
- Intermediate results accumulate in memory
- Consider clearing intermediate results for very long tasks
- Pause/resume requires polling the state
- Each step should be independently executable
- Avoid storing large data in intermediate results
