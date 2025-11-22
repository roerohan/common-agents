# QueueAgent

**Type:** Permanent (Long-Lived)

## Overview

QueueAgent provides a durable priority queue with dead letter queue support. It manages task queuing, priority-based ordering, retry logic, and handles failed items separately for later inspection or reprocessing.

## Responsibilities

- Enqueue items with priority levels
- Dequeue items in priority order
- Maintain a dead letter queue for failed items
- Track queue statistics (enqueued, dequeued, sizes)
- Support peek operations without removal
- Handle item retries with configurable limits

## Lifecycle

QueueAgent is a permanent agent that:
1. **Initializes** with empty queues
2. **Receives enqueue requests** continuously
3. **Serves dequeue requests** in priority order
4. **Maintains state** indefinitely
5. **Manages dead letter queue** for failures

## Callable Methods

### `enqueue(payload: T, priority: number = 0): Promise<string>`

Add an item to the queue with a priority.

**Parameters:**
- `payload` - The data to enqueue
- `priority` - Priority level (higher = processed first, default: 0)

**Returns:** Unique item ID for tracking

**Example:**
```typescript
// Enqueue with default priority
const id1 = await queue.enqueue({ task: 'process-data', data: {...} });

// Enqueue with high priority
const id2 = await queue.enqueue(
  { task: 'urgent-notification', user: 'user-123' },
  10 // High priority
);

// Enqueue with low priority
const id3 = await queue.enqueue(
  { task: 'background-cleanup' },
  -5 // Low priority
);

console.log(`Enqueued items: ${id1}, ${id2}, ${id3}`);
```

### `dequeueItem(): Promise<QueueItem<T> | null>`

Remove and return the highest priority item from the queue.

**Returns:** QueueItem or null if queue is empty

**QueueItem contains:**
- `id` - Unique item identifier
- `payload` - The enqueued data
- `priority` - Priority level
- `enqueuedAt` - Timestamp when enqueued
- `retries` - Number of retry attempts
- `metadata` - Optional metadata

**Example:**
```typescript
const item = await queue.dequeueItem();

if (item) {
  console.log(`Processing item ${item.id}`);
  console.log(`Priority: ${item.priority}`);
  console.log(`Enqueued: ${new Date(item.enqueuedAt).toLocaleString()}`);

  try {
    // Process the item
    await processTask(item.payload);
  } catch (error) {
    // Handle failure
    await queue.moveToDeadLetter(item.id);
  }
} else {
  console.log('Queue is empty');
}
```

### `peek(): Promise<QueueItem<T> | null>`

View the next item without removing it from the queue.

**Example:**
```typescript
const nextItem = await queue.peek();

if (nextItem) {
  console.log(`Next item: ${nextItem.id} (priority: ${nextItem.priority})`);
  console.log(`Payload:`, nextItem.payload);
} else {
  console.log('Queue is empty');
}
```

### `getQueueLength(): Promise<number>`

Get the current number of items in the queue.

**Example:**
```typescript
const length = await queue.getQueueLength();
console.log(`Queue has ${length} items`);

if (length > 100) {
  console.warn('Queue is getting large - consider scaling');
}
```

### `moveToDeadLetter(itemId: string): Promise<boolean>`

Move an item to the dead letter queue (for failed items).

**Returns:** `true` if moved, `false` if item not found

**Example:**
```typescript
const item = await queue.dequeueItem();

if (item) {
  try {
    await processItem(item.payload);
  } catch (error) {
    console.error(`Item ${item.id} failed: ${error}`);

    // Move to dead letter queue for later inspection
    await queue.moveToDeadLetter(item.id);
  }
}
```

### `getDeadLetterQueue(): Promise<QueueItem<T>[]>`

Get all items in the dead letter queue.

**Example:**
```typescript
const dlq = await queue.getDeadLetterQueue();
console.log(`Dead letter queue has ${dlq.length} items`);

// Inspect failed items
dlq.forEach(item => {
  console.log(`Failed item ${item.id}:`);
  console.log(`  Payload:`, item.payload);
  console.log(`  Retries: ${item.retries}`);
  console.log(`  Enqueued at: ${new Date(item.enqueuedAt).toLocaleString()}`);
});

// Optionally, requeue items after fixing issues
for (const item of dlq) {
  if (shouldRetry(item)) {
    await queue.enqueue(item.payload, item.priority);
  }
}
```

### `clearQueue(): Promise<void>`

Clear all items from the main queue (does not affect dead letter queue).

**Example:**
```typescript
await queue.clearQueue();
console.log('Queue cleared');
```

### `getStats(): Promise<QueueStats>`

Get queue statistics.

**Returns:**
- `totalEnqueued` - Total items ever enqueued
- `totalDequeued` - Total items ever dequeued
- `currentSize` - Current queue size
- `deadLetterSize` - Dead letter queue size

**Example:**
```typescript
const stats = await queue.getStats();
console.log(`
  Total Enqueued: ${stats.totalEnqueued}
  Total Dequeued: ${stats.totalDequeued}
  Current Size: ${stats.currentSize}
  Dead Letter Size: ${stats.deadLetterSize}
  Processing Rate: ${(stats.totalDequeued / stats.totalEnqueued * 100).toFixed(2)}%
`);
```

## Complete Example

```typescript
import { QueueAgent, type QueueItem } from 'common-agents';
import { callable } from 'agents';

interface EmailTask {
  to: string;
  subject: string;
  body: string;
  templateId?: string;
}

class EmailQueue extends QueueAgent<Env, QueueAgentState, EmailTask> {
  protected override maxRetries = 3;

  // Custom method to enqueue with automatic prioritization
  @callable()
  async enqueueEmail(email: EmailTask, isUrgent: boolean = false): Promise<string> {
    const priority = isUrgent ? 10 : 0;

    // Add metadata
    const itemId = await this.enqueue(email, priority);

    this.log(`Enqueued email to ${email.to} (${isUrgent ? 'urgent' : 'normal'})`);

    return itemId;
  }

  // Custom method to process next email
  @callable()
  async processNextEmail(): Promise<boolean> {
    const item = await this.dequeueItem();

    if (!item) {
      return false; // Queue empty
    }

    try {
      await this.sendEmail(item.payload);
      this.log(`Sent email to ${item.payload.to}`);
      return true;
    } catch (error) {
      this.log(`Failed to send email: ${error}`, 'error');

      // Check retry limit
      if (item.retries >= this.maxRetries) {
        await this.moveToDeadLetter(item.id);
        this.log(`Moved item ${item.id} to dead letter queue`);
      } else {
        // Re-enqueue with incremented retry count
        await this.enqueue(
          item.payload,
          item.priority - 1 // Lower priority for retries
        );
      }

      return false;
    }
  }

  // Custom method to get failed emails
  @callable()
  async getFailedEmails(): Promise<EmailTask[]> {
    const dlq = await this.getDeadLetterQueue();
    return dlq.map(item => item.payload);
  }

  private async sendEmail(email: EmailTask): Promise<void> {
    // Email sending logic
    this.log(`Sending email to ${email.to}: ${email.subject}`);

    // Simulate sending
    await fetch('https://api.example.com/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(email)
    });
  }
}
```

## Common Usage Pattern

```typescript
// 1. Get queue instance
const queue = await getAgentByName(env, 'EMAIL_QUEUE', 'main');

// 2. Enqueue items with priorities
await queue.enqueueEmail(
  {
    to: 'user@example.com',
    subject: 'Welcome!',
    body: 'Welcome to our platform'
  },
  false // Normal priority
);

await queue.enqueueEmail(
  {
    to: 'admin@example.com',
    subject: 'URGENT: System Alert',
    body: 'Critical error detected'
  },
  true // High priority
);

// 3. Process queue
while (await queue.getQueueLength() > 0) {
  const success = await queue.processNextEmail();

  if (success) {
    console.log('Email sent successfully');
  } else {
    console.log('Failed to send email');
  }

  // Rate limiting
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// 4. Check for failures
const failedEmails = await queue.getFailedEmails();
if (failedEmails.length > 0) {
  console.warn(`${failedEmails.length} emails failed after retries`);

  // Alert administrators
  await notifyAdmin({
    type: 'failed_emails',
    count: failedEmails.length,
    emails: failedEmails
  });
}

// 5. Monitor queue health
const stats = await queue.getStats();
if (stats.currentSize > 1000) {
  console.warn('Queue backlog detected - scaling workers');
}
```

## Worker Pool Pattern

```typescript
class QueueWorker {
  private isRunning = false;

  async start(queueName: string, env: Env): Promise<void> {
    this.isRunning = true;

    while (this.isRunning) {
      const queue = await getAgentByName(env, queueName, 'main');
      const item = await queue.dequeueItem();

      if (item) {
        try {
          await this.processItem(item.payload);
        } catch (error) {
          console.error(`Processing failed: ${error}`);
          await queue.moveToDeadLetter(item.id);
        }
      } else {
        // Queue empty - wait before checking again
        await this.delay(5000);
      }
    }
  }

  stop(): void {
    this.isRunning = false;
  }

  private async processItem(payload: any): Promise<void> {
    // Processing logic
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage: Start multiple workers
const workers = [
  new QueueWorker(),
  new QueueWorker(),
  new QueueWorker()
];

for (const worker of workers) {
  worker.start('TASK_QUEUE', env);
}
```

## Rate-Limited Queue Example

```typescript
class RateLimitedQueue extends QueueAgent<Env, QueueAgentState, any> {
  private lastDequeueTime = 0;
  private minIntervalMs = 1000; // 1 second between dequeues

  override async dequeueItem(): Promise<QueueItem<any> | null> {
    const now = Date.now();
    const timeSinceLastDequeue = now - this.lastDequeueTime;

    if (timeSinceLastDequeue < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - timeSinceLastDequeue;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastDequeueTime = Date.now();
    return super.dequeueItem();
  }

  @callable()
  async setRateLimit(requestsPerSecond: number): Promise<void> {
    this.minIntervalMs = 1000 / requestsPerSecond;
    this.log(`Rate limit set to ${requestsPerSecond} requests/second`);
  }
}
```

## Priority-Based Task Queue

```typescript
// Task priorities
enum TaskPriority {
  CRITICAL = 100,
  HIGH = 50,
  NORMAL = 0,
  LOW = -50,
  BACKGROUND = -100
}

interface Task {
  type: string;
  data: any;
}

class TaskQueue extends QueueAgent<Env, QueueAgentState, Task> {
  @callable()
  async enqueueCritical(task: Task): Promise<string> {
    return this.enqueue(task, TaskPriority.CRITICAL);
  }

  @callable()
  async enqueueHigh(task: Task): Promise<string> {
    return this.enqueue(task, TaskPriority.HIGH);
  }

  @callable()
  async enqueueNormal(task: Task): Promise<string> {
    return this.enqueue(task, TaskPriority.NORMAL);
  }

  @callable()
  async enqueueLow(task: Task): Promise<string> {
    return this.enqueue(task, TaskPriority.LOW);
  }

  @callable()
  async enqueueBackground(task: Task): Promise<string> {
    return this.enqueue(task, TaskPriority.BACKGROUND);
  }

  @callable()
  async getQueueBreakdown(): Promise<Record<string, number>> {
    const items = this.state.queue;

    return {
      critical: items.filter(i => i.priority >= TaskPriority.CRITICAL).length,
      high: items.filter(i => i.priority >= TaskPriority.HIGH && i.priority < TaskPriority.CRITICAL).length,
      normal: items.filter(i => i.priority >= TaskPriority.NORMAL && i.priority < TaskPriority.HIGH).length,
      low: items.filter(i => i.priority >= TaskPriority.LOW && i.priority < TaskPriority.NORMAL).length,
      background: items.filter(i => i.priority < TaskPriority.LOW).length
    };
  }
}

// Usage
const queue = await getAgentByName(env, 'TASK_QUEUE', 'main');

await queue.enqueueCritical({ type: 'security-alert', data: {...} });
await queue.enqueueHigh({ type: 'user-request', data: {...} });
await queue.enqueueNormal({ type: 'data-sync', data: {...} });
await queue.enqueueBackground({ type: 'analytics', data: {...} });

const breakdown = await queue.getQueueBreakdown();
console.log('Queue breakdown:', breakdown);
```

## Dead Letter Queue Management

```typescript
class ManagedQueue extends QueueAgent<Env, QueueAgentState, any> {
  @callable()
  async retryDeadLetterItems(maxItems: number = 10): Promise<number> {
    const dlq = await this.getDeadLetterQueue();
    const itemsToRetry = dlq.slice(0, maxItems);

    let retried = 0;
    for (const item of itemsToRetry) {
      // Reset retries and re-enqueue
      await this.enqueue(item.payload, item.priority);
      retried++;
    }

    this.log(`Retried ${retried} items from dead letter queue`);
    return retried;
  }

  @callable()
  async clearDeadLetterQueue(): Promise<number> {
    const dlq = await this.getDeadLetterQueue();
    const count = dlq.length;

    this.setState({
      ...this.state,
      deadLetterQueue: [],
      stats: {
        ...this.state.stats,
        deadLetterSize: 0
      }
    });

    this.log(`Cleared ${count} items from dead letter queue`);
    return count;
  }

  @callable()
  async exportDeadLetterQueue(): Promise<any[]> {
    const dlq = await this.getDeadLetterQueue();

    // Export for external analysis
    return dlq.map(item => ({
      id: item.id,
      payload: item.payload,
      priority: item.priority,
      enqueuedAt: item.enqueuedAt,
      retries: item.retries,
      failedAt: Date.now()
    }));
  }
}
```

## Scheduled Queue Processing

```typescript
// Combine QueueAgent with SchedulerAgent
class ScheduledQueueProcessor {
  private queueName: string;
  private schedulerName: string;

  constructor(queueName: string, schedulerName: string) {
    this.queueName = queueName;
    this.schedulerName = schedulerName;
  }

  async setup(env: Env): Promise<void> {
    const scheduler = await getAgentByName(env, this.schedulerName, 'main');

    // Schedule queue processing every minute
    await scheduler.scheduleRecurringTask(
      'process-queue',
      'processQueue',
      60 * 1000, // 1 minute
      { queueName: this.queueName }
    );
  }

  async processQueue(payload: { queueName: string }): Promise<void> {
    const queue = await getAgentByName(
      this.env as any,
      payload.queueName,
      'main'
    );

    // Process up to 10 items
    for (let i = 0; i < 10; i++) {
      const item = await queue.dequeueItem();
      if (!item) break;

      try {
        await this.processItem(item);
      } catch (error) {
        await queue.moveToDeadLetter(item.id);
      }
    }
  }

  private async processItem(item: QueueItem<any>): Promise<void> {
    // Processing logic
  }
}
```

## Best Practices

1. **Use priorities effectively** - Reserve high priorities for truly urgent items
2. **Set retry limits** - Prevent infinite retry loops
3. **Monitor queue size** - Alert on backlog growth
4. **Process DLQ regularly** - Investigate and fix root causes
5. **Implement idempotency** - Handle duplicate processing gracefully
6. **Use rate limiting** - Prevent overwhelming downstream services
7. **Clear old DLQ items** - Periodically clean up after fixes
8. **Track statistics** - Monitor enqueue/dequeue rates

## Performance Considerations

- Items are stored in durable state (persistent)
- Queue is sorted by priority on each enqueue (O(n log n))
- Dequeue is O(1) (takes first item)
- Dead letter queue grows unbounded - monitor and clear
- Large queues may impact performance
- Consider pagination for very large DLQs
- Statistics tracked synchronously on operations
