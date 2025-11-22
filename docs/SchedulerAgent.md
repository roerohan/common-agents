# SchedulerAgent

**Type:** Permanent (Long-Lived)

## Overview

SchedulerAgent schedules and executes tasks at specific times or intervals using Cloudflare's alarm system. It supports one-time tasks, recurring tasks, and provides execution history tracking.

## Responsibilities

- Schedule one-time and recurring tasks
- Execute tasks at specified times using alarms
- Maintain execution history and statistics
- Support task enabling/disabling
- Handle task failures gracefully
- Automatically reschedule recurring tasks

## Lifecycle

SchedulerAgent is a permanent agent that:
1. **Initializes** with existing scheduled tasks
2. **Schedules alarms** for due tasks
3. **Executes tasks** when alarms trigger
4. **Maintains state** indefinitely
5. **Reschedules** recurring tasks automatically

## Callable Methods

### `scheduleTask<T>(name: string, callback: string, executeAt: number | Date, payload?: T): Promise<string>`

Schedule a one-time task to execute at a specific time.

**Parameters:**
- `name` - Human-readable task name
- `callback` - Method name to call when task executes
- `executeAt` - When to execute (timestamp or Date object)
- `payload` - Optional data to pass to callback

**Returns:** Task ID for tracking

**Example:**
```typescript
// Schedule task for specific time
const taskId = await scheduler.scheduleTask(
  'send-report',
  'generateReport',
  new Date('2024-01-01T09:00:00Z'),
  { reportType: 'daily', recipients: ['admin@example.com'] }
);

// Schedule task in 1 hour
const oneHourFromNow = Date.now() + (60 * 60 * 1000);
const taskId2 = await scheduler.scheduleTask(
  'cleanup',
  'runCleanup',
  oneHourFromNow
);
```

### `scheduleRecurringTask<T>(name: string, callback: string, intervalMs: number, payload?: T): Promise<string>`

Schedule a recurring task that executes repeatedly at a fixed interval.

**Parameters:**
- `name` - Human-readable task name
- `callback` - Method name to call on each execution
- `intervalMs` - Interval between executions (milliseconds)
- `payload` - Optional data to pass to callback

**Returns:** Task ID for tracking

**Example:**
```typescript
// Check for updates every 5 minutes
const taskId = await scheduler.scheduleRecurringTask(
  'update-check',
  'checkForUpdates',
  5 * 60 * 1000
);

// Send heartbeat every 30 seconds
const heartbeatId = await scheduler.scheduleRecurringTask(
  'heartbeat',
  'sendHeartbeat',
  30 * 1000,
  { service: 'api-gateway' }
);

// Daily backup at midnight
const dailyMs = 24 * 60 * 60 * 1000;
const backupId = await scheduler.scheduleRecurringTask(
  'daily-backup',
  'performBackup',
  dailyMs,
  { destination: 's3://backups/' }
);
```

### `cancelTask(taskId: string): Promise<boolean>`

Cancel a scheduled task.

**Returns:** `true` if cancelled, `false` if not found

**Example:**
```typescript
const cancelled = await scheduler.cancelTask(taskId);
if (cancelled) {
  console.log('Task cancelled successfully');
}
```

### `getScheduledTasks(): Promise<ScheduledTask[]>`

Get all scheduled tasks (both enabled and disabled).

**Example:**
```typescript
const tasks = await scheduler.getScheduledTasks();
console.log(`${tasks.length} tasks scheduled`);

tasks.forEach(task => {
  const nextTime = new Date(task.nextExecuteAt!).toISOString();
  console.log(`${task.name}: next at ${nextTime} (${task.scheduleType})`);
});
```

### `getTask(taskId: string): Promise<ScheduledTask | undefined>`

Get details of a specific scheduled task.

**Example:**
```typescript
const task = await scheduler.getTask(taskId);
if (task) {
  console.log(`Task: ${task.name}`);
  console.log(`Type: ${task.scheduleType}`);
  console.log(`Executed: ${task.executionCount} times`);
  console.log(`Last run: ${task.lastExecutedAt ? new Date(task.lastExecutedAt) : 'Never'}`);
}
```

### `setTaskEnabled(taskId: string, enabled: boolean): Promise<boolean>`

Enable or disable a task without deleting it.

**Returns:** `true` if updated, `false` if not found

**Example:**
```typescript
// Temporarily disable a task
await scheduler.setTaskEnabled(taskId, false);

// Re-enable later
await scheduler.setTaskEnabled(taskId, true);
```

### `executeTask(taskId: string): Promise<void>`

Manually execute a task immediately (outside its schedule).

**Example:**
```typescript
// Trigger a task immediately for testing
await scheduler.executeTask(taskId);
console.log('Task executed manually');
```

### `getExecutionHistory(limit?: number): Promise<ExecutionHistory[]>`

Get task execution history.

**Returns:** Array of execution records with:
- `taskId` - The task that was executed
- `executedAt` - Timestamp of execution
- `success` - Whether execution succeeded
- `error` - Error message (if failed)

**Example:**
```typescript
// Get last 10 executions
const history = await scheduler.getExecutionHistory(10);

history.forEach(entry => {
  const time = new Date(entry.executedAt).toLocaleString();
  const status = entry.success ? 'SUCCESS' : `FAILED: ${entry.error}`;
  console.log(`${time} - Task ${entry.taskId}: ${status}`);
});

// Get all execution history
const allHistory = await scheduler.getExecutionHistory();
```

### `getStats(): Promise<SchedulerStats>`

Get scheduler statistics.

**Returns:**
- `totalTasks` - Total number of tasks created
- `activeTasks` - Currently active (enabled) tasks
- `totalExecutions` - Total execution count
- `successfulExecutions` - Number of successful executions
- `failedExecutions` - Number of failed executions

**Example:**
```typescript
const stats = await scheduler.getStats();
console.log(`
  Total Tasks: ${stats.totalTasks}
  Active: ${stats.activeTasks}
  Total Executions: ${stats.totalExecutions}
  Success Rate: ${(stats.successfulExecutions / stats.totalExecutions * 100).toFixed(2)}%
  Failures: ${stats.failedExecutions}
`);
```

## Protected Methods (For Subclasses)

### `executeScheduledTask(task: ScheduledTask): Promise<void>`

Override to customize task execution behavior.

**Example:**
```typescript
protected override async executeScheduledTask(task: ScheduledTask): Promise<void> {
  // Add pre-execution logic
  await this.notifyTaskStarting(task);

  // Call parent implementation
  await super.executeScheduledTask(task);

  // Add post-execution logic
  await this.notifyTaskCompleted(task);
}
```

## Complete Example

```typescript
import { SchedulerAgent, type ScheduledTask } from 'common-agents';
import { callable } from 'agents';

interface ReportConfig {
  reportType: string;
  recipients: string[];
}

interface BackupConfig {
  destination: string;
  compress: boolean;
}

class TaskScheduler extends SchedulerAgent<Env, SchedulerAgentState> {
  override async initialize(): Promise<void> {
    await super.initialize();

    // Set up default recurring tasks
    await this.setupDefaultTasks();
  }

  private async setupDefaultTasks() {
    // Schedule hourly cleanup
    await this.scheduleRecurringTask(
      'hourly-cleanup',
      'performCleanup',
      60 * 60 * 1000 // 1 hour
    );

    // Schedule daily report
    await this.scheduleRecurringTask(
      'daily-report',
      'generateDailyReport',
      24 * 60 * 60 * 1000, // 24 hours
      { reportType: 'summary', recipients: ['admin@example.com'] } as ReportConfig
    );
  }

  // Task callback methods
  async performCleanup(): Promise<void> {
    this.log('Running cleanup task');

    // Cleanup logic
    await this.cleanupExpiredData();
    await this.cleanupTempFiles();

    this.log('Cleanup completed');
  }

  async generateDailyReport(payload: ReportConfig): Promise<void> {
    this.log(`Generating ${payload.reportType} report`);

    // Generate report
    const report = await this.buildReport(payload.reportType);

    // Send to recipients
    for (const recipient of payload.recipients) {
      await this.sendEmail(recipient, 'Daily Report', report);
    }

    this.log('Report sent');
  }

  async performBackup(payload: BackupConfig): Promise<void> {
    this.log('Starting backup');

    // Get data to backup
    const data = await this.collectBackupData();

    // Compress if needed
    const backupData = payload.compress
      ? await this.compressData(data)
      : data;

    // Upload to destination
    await this.uploadBackup(payload.destination, backupData);

    this.log('Backup completed');
  }

  // Helper methods
  private async cleanupExpiredData(): Promise<void> {
    // Implementation
  }

  private async cleanupTempFiles(): Promise<void> {
    // Implementation
  }

  private async buildReport(type: string): Promise<string> {
    return `Report of type: ${type}`;
  }

  private async sendEmail(to: string, subject: string, body: string): Promise<void> {
    this.log(`Sending email to ${to}`);
    // Email sending logic
  }

  private async collectBackupData(): Promise<ArrayBuffer> {
    // Collect data to backup
    return new ArrayBuffer(0);
  }

  private async compressData(data: ArrayBuffer): Promise<ArrayBuffer> {
    // Compression logic
    return data;
  }

  private async uploadBackup(destination: string, data: ArrayBuffer): Promise<void> {
    this.log(`Uploading to ${destination}`);
    // Upload logic
  }
}
```

## Common Usage Pattern

```typescript
// 1. Get scheduler instance
const scheduler = await getAgentByName(env.SCHEDULER, 'main');

// 2. Schedule various tasks
// One-time task
const reportId = await scheduler.scheduleTask(
  'quarterly-report',
  'generateQuarterlyReport',
  new Date('2024-04-01T00:00:00Z'),
  { quarter: 'Q1', year: 2024 }
);

// Recurring task - check every 5 minutes
const monitorId = await scheduler.scheduleRecurringTask(
  'system-monitor',
  'checkSystemHealth',
  5 * 60 * 1000
);

// 3. Monitor task execution
const tasks = await scheduler.getScheduledTasks();
console.log(`Active tasks: ${tasks.filter(t => t.enabled).length}`);

// 4. Check execution history
const history = await scheduler.getExecutionHistory(10);
const failures = history.filter(h => !h.success);
if (failures.length > 0) {
  console.log('Recent failures:');
  failures.forEach(f => {
    console.log(`  Task ${f.taskId}: ${f.error}`);
  });
}

// 5. Manage tasks
// Pause a task temporarily
await scheduler.setTaskEnabled(monitorId, false);

// Resume later
await scheduler.setTaskEnabled(monitorId, true);

// Cancel a task
await scheduler.cancelTask(reportId);

// 6. View statistics
const stats = await scheduler.getStats();
console.log(`Success rate: ${(stats.successfulExecutions / stats.totalExecutions * 100).toFixed(2)}%`);
```

## Integration with Notifications

```typescript
class NotificationScheduler extends SchedulerAgent<Env, SchedulerAgentState> {
  // Schedule notification campaign
  @callable()
  async scheduleNotificationCampaign(
    campaignId: string,
    notifications: Array<{ time: Date; message: string; recipients: string[] }>
  ): Promise<string[]> {
    const taskIds: string[] = [];

    for (const notification of notifications) {
      const taskId = await this.scheduleTask(
        `campaign-${campaignId}`,
        'sendNotification',
        notification.time,
        notification
      );
      taskIds.push(taskId);
    }

    return taskIds;
  }

  async sendNotification(payload: { message: string; recipients: string[] }): Promise<void> {
    this.log(`Sending notification to ${payload.recipients.length} recipients`);

    // Send notification
    for (const recipient of payload.recipients) {
      await this.sendPushNotification(recipient, payload.message);
    }
  }

  private async sendPushNotification(recipient: string, message: string): Promise<void> {
    // Push notification logic
    this.log(`Sent to ${recipient}: ${message}`);
  }
}
```

## Maintenance Tasks Example

```typescript
class MaintenanceScheduler extends SchedulerAgent<Env, SchedulerAgentState> {
  override async initialize(): Promise<void> {
    await super.initialize();
    await this.setupMaintenanceTasks();
  }

  private async setupMaintenanceTasks() {
    // Database cleanup every night at 2 AM
    const twoAM = new Date();
    twoAM.setHours(2, 0, 0, 0);
    if (twoAM < new Date()) {
      twoAM.setDate(twoAM.getDate() + 1);
    }

    await this.scheduleRecurringTask(
      'db-cleanup',
      'cleanDatabase',
      24 * 60 * 60 * 1000,
      { tables: ['sessions', 'temp_data', 'logs'] }
    );

    // Cache refresh every 15 minutes
    await this.scheduleRecurringTask(
      'cache-refresh',
      'refreshCache',
      15 * 60 * 1000
    );

    // Log rotation every 6 hours
    await this.scheduleRecurringTask(
      'log-rotation',
      'rotateLogs',
      6 * 60 * 60 * 1000
    );
  }

  async cleanDatabase(payload: { tables: string[] }): Promise<void> {
    for (const table of payload.tables) {
      await this.cleanTable(table);
    }
  }

  async refreshCache(): Promise<void> {
    this.log('Refreshing cache');
    // Cache refresh logic
  }

  async rotateLogs(): Promise<void> {
    this.log('Rotating logs');
    // Log rotation logic
  }

  private async cleanTable(table: string): Promise<void> {
    this.log(`Cleaning table: ${table}`);
    // Cleanup logic
  }
}
```

## Best Practices

1. **Use descriptive names** - Make task names clear and searchable
2. **Handle failures gracefully** - Implement error handling in callbacks
3. **Set reasonable intervals** - Avoid scheduling too frequently
4. **Clean up completed one-time tasks** - Remove tasks after execution
5. **Monitor execution history** - Track failures and adjust schedules
6. **Use metadata** - Store additional context with tasks
7. **Test callback methods** - Ensure methods exist before scheduling
8. **Consider timezone** - Be aware of timezone when scheduling

## Performance Considerations

- Alarms use Cloudflare's durable alarm system
- Only one alarm is active at a time (earliest task)
- Execution history is limited to last 1000 entries
- Recurring tasks automatically reschedule after execution
- One-time tasks are disabled after execution (not deleted)
- Task execution is sequential (not parallel)
