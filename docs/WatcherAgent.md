# WatcherAgent

**Type:** Permanent (Long-Lived)

## Overview

WatcherAgent monitors external resources for changes and triggers actions when conditions are met. It uses Cloudflare's alarm system to periodically check resources and maintains a history of triggered events.

## Responsibilities

- Monitor external resources (URLs, files, APIs, etc.)
- Evaluate conditions (change detection, thresholds, patterns)
- Execute callbacks when conditions are met
- Schedule periodic checks using alarms
- Maintain trigger history
- Track statistics on watches and triggers

## Lifecycle

WatcherAgent is a permanent agent that:
1. **Initializes** with existing watches
2. **Schedules alarms** for resource checks
3. **Monitors resources** continuously
4. **Triggers callbacks** when conditions match
5. **Maintains state** indefinitely

## Callable Methods

### `watch(resource: Resource, condition: Condition, checkIntervalMs: number = 60000): Promise<string>`

Start monitoring a resource.

**Parameters:**
- `resource` - Resource to monitor:
  - `url` - Optional URL to fetch
  - `type` - Resource type (e.g., 'api', 'file', 'metric')
  - `identifier` - Unique resource identifier
  - `metadata` - Optional resource metadata
- `condition` - Condition to evaluate:
  - `type` - "change", "threshold", or "pattern"
  - `value` - Value to compare against
  - `comparator` - "eq", "ne", "gt", "lt", "gte", "lte", "contains"
- `checkIntervalMs` - How often to check (default: 60000ms = 1 minute)

**Returns:** Watch ID for tracking

**Example:**
```typescript
// Watch for API changes
const watchId1 = await watcher.watch(
  {
    url: 'https://api.example.com/status',
    type: 'api',
    identifier: 'api-status'
  },
  {
    type: 'change' // Trigger on any change
  },
  60000 // Check every minute
);

// Watch for threshold
const watchId2 = await watcher.watch(
  {
    url: 'https://api.example.com/metrics/cpu',
    type: 'metric',
    identifier: 'cpu-usage'
  },
  {
    type: 'threshold',
    value: 80,
    comparator: 'gt' // Trigger when > 80
  },
  30000 // Check every 30 seconds
);

// Watch for pattern
const watchId3 = await watcher.watch(
  {
    url: 'https://api.example.com/logs',
    type: 'log',
    identifier: 'error-logs'
  },
  {
    type: 'pattern',
    value: 'ERROR' // Trigger when logs contain "ERROR"
  },
  5000 // Check every 5 seconds
);
```

### `stopWatching(watchId: string): Promise<boolean>`

Stop monitoring a resource.

**Returns:** `true` if stopped, `false` if watch not found

**Example:**
```typescript
const stopped = await watcher.stopWatching(watchId);
if (stopped) {
  console.log('Watch stopped');
}
```

### `getWatchedResources(): Promise<WatchedResource[]>`

Get all watched resources.

**Returns:** Array of WatchedResource objects:
- `id` - Watch ID
- `resource` - The monitored resource
- `condition` - The evaluation condition
- `checkIntervalMs` - Check interval
- `lastCheckedAt` - Last check timestamp
- `lastValue` - Last observed value
- `triggerCount` - Number of times triggered
- `enabled` - Whether watch is active
- `callback` - Optional callback method name

**Example:**
```typescript
const watches = await watcher.getWatchedResources();
console.log(`Monitoring ${watches.length} resources`);

watches.forEach(watch => {
  console.log(`${watch.resource.identifier}:`);
  console.log(`  Type: ${watch.resource.type}`);
  console.log(`  Condition: ${watch.condition.type}`);
  console.log(`  Triggers: ${watch.triggerCount}`);
  console.log(`  Last checked: ${watch.lastCheckedAt ? new Date(watch.lastCheckedAt) : 'Never'}`);
});
```

### `getTriggerHistory(limit?: number): Promise<TriggerHistory[]>`

Get history of triggered events.

**Returns:** Array of trigger records:
- `watchId` - ID of watch that triggered
- `triggeredAt` - Timestamp of trigger
- `oldValue` - Previous value
- `newValue` - New value that triggered condition

**Example:**
```typescript
// Get last 10 triggers
const history = await watcher.getTriggerHistory(10);

history.forEach(trigger => {
  const time = new Date(trigger.triggeredAt).toLocaleString();
  console.log(`${time} - Watch ${trigger.watchId} triggered`);
  console.log(`  Old value: ${trigger.oldValue}`);
  console.log(`  New value: ${trigger.newValue}`);
});

// Get all trigger history
const allHistory = await watcher.getTriggerHistory();
```

### `getStats(): Promise<WatcherStats>`

Get watcher statistics.

**Returns:**
- `totalWatches` - Total watches created
- `activeWatches` - Currently active watches
- `totalTriggers` - Total times conditions triggered
- `totalChecks` - Total resource checks performed

**Example:**
```typescript
const stats = await watcher.getStats();
console.log(`
  Total Watches: ${stats.totalWatches}
  Active: ${stats.activeWatches}
  Total Checks: ${stats.totalChecks}
  Total Triggers: ${stats.totalTriggers}
  Trigger Rate: ${(stats.totalTriggers / stats.totalChecks * 100).toFixed(2)}%
`);
```

## Protected Methods (For Subclasses)

### `fetchResourceValue(resource: Resource): Promise<unknown>`

**Must be overridden** to fetch actual resource values.

**Example Implementation:**
```typescript
class APIWatcher extends WatcherAgent<Env, WatcherAgentState> {
  protected override async fetchResourceValue(resource: Resource): Promise<unknown> {
    if (resource.url) {
      try {
        const response = await fetch(resource.url);

        if (resource.type === 'json-api') {
          return await response.json();
        } else if (resource.type === 'text') {
          return await response.text();
        } else if (resource.type === 'status') {
          return response.status;
        }

        return await response.text();
      } catch (error) {
        this.log(`Failed to fetch ${resource.identifier}: ${error}`, 'error');
        return null;
      }
    }

    // Handle non-URL resources
    if (resource.type === 'database-count') {
      return await this.getDatabaseCount(resource.identifier);
    }

    return null;
  }

  private async getDatabaseCount(table: string): Promise<number> {
    // Database query logic
    return 0;
  }
}
```

### `evaluateCondition(condition: Condition, oldValue: unknown, newValue: unknown): boolean`

Override to customize condition evaluation logic.

**Example:**
```typescript
protected override evaluateCondition(
  condition: Condition,
  oldValue: unknown,
  newValue: unknown
): boolean {
  // Add custom condition types
  if (condition.type === 'custom-threshold') {
    return this.evaluateCustomThreshold(condition, newValue);
  }

  // Use default evaluation for standard types
  return super.evaluateCondition(condition, oldValue, newValue);
}

private evaluateCustomThreshold(condition: Condition, value: unknown): boolean {
  // Custom threshold logic
  return false;
}
```

## Complete Example

```typescript
import { WatcherAgent, type Resource, type Condition } from 'common-agents';
import { callable } from 'agents';

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  lastCheck: number;
}

class ServiceMonitor extends WatcherAgent<Env, WatcherAgentState> {
  override async initialize(): Promise<void> {
    await super.initialize();
    await this.setupDefaultWatches();
  }

  private async setupDefaultWatches() {
    // Watch API status
    await this.watch(
      {
        url: 'https://api.example.com/health',
        type: 'health-check',
        identifier: 'api-health'
      },
      {
        type: 'pattern',
        value: 'down' // Alert if status is "down"
      },
      30000 // Check every 30 seconds
    );

    // Watch response time
    await this.watch(
      {
        url: 'https://api.example.com/health',
        type: 'response-time',
        identifier: 'api-response-time'
      },
      {
        type: 'threshold',
        value: 1000, // Alert if > 1 second
        comparator: 'gt'
      },
      60000 // Check every minute
    );

    // Watch error rate
    await this.watch(
      {
        url: 'https://api.example.com/metrics/errors',
        type: 'error-rate',
        identifier: 'api-errors'
      },
      {
        type: 'threshold',
        value: 5, // Alert if > 5% error rate
        comparator: 'gt'
      },
      120000 // Check every 2 minutes
    );
  }

  protected override async fetchResourceValue(resource: Resource): Promise<unknown> {
    if (!resource.url) return null;

    try {
      const startTime = Date.now();
      const response = await fetch(resource.url);
      const responseTime = Date.now() - startTime;

      if (resource.type === 'health-check') {
        const data = await response.json();
        return data.status;
      }

      if (resource.type === 'response-time') {
        return responseTime;
      }

      if (resource.type === 'error-rate') {
        const data = await response.json();
        return data.errorRate;
      }

      return await response.text();
    } catch (error) {
      this.log(`Failed to fetch ${resource.identifier}: ${error}`, 'error');

      // Return error status
      if (resource.type === 'health-check') {
        return 'down';
      }

      return null;
    }
  }

  // Custom callback for health check alerts
  async onHealthCheckTriggered(watch: WatchedResource, value: unknown): Promise<void> {
    this.log(`Health check alert: ${watch.resource.identifier} is ${value}`, 'error');

    // Send alert
    await this.sendAlert({
      type: 'health-check',
      resource: watch.resource.identifier,
      status: value as string,
      severity: 'critical'
    });

    // Trigger incident response
    await this.createIncident(watch.resource.identifier, value as string);
  }

  // Custom callback for response time alerts
  async onResponseTimeTriggered(watch: WatchedResource, value: unknown): Promise<void> {
    const responseTime = value as number;
    this.log(`Response time alert: ${responseTime}ms`, 'warn');

    await this.sendAlert({
      type: 'performance',
      resource: watch.resource.identifier,
      responseTime,
      severity: responseTime > 2000 ? 'high' : 'medium'
    });
  }

  private async sendAlert(alert: any): Promise<void> {
    // Send to alerting system (e.g., PagerDuty, Slack)
    await fetch('https://alerts.example.com/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert)
    });
  }

  private async createIncident(service: string, status: string): Promise<void> {
    this.log(`Creating incident for ${service}: ${status}`);
    // Incident management logic
  }

  // Method to add watch with callback
  @callable()
  async watchWithCallback(
    resource: Resource,
    condition: Condition,
    callback: string,
    checkIntervalMs: number = 60000
  ): Promise<string> {
    const watchId = await this.watch(resource, condition, checkIntervalMs);

    // Update watch to include callback
    const watch = this.state.watchedResources[watchId];
    if (watch) {
      this.setState({
        ...this.state,
        watchedResources: {
          ...this.state.watchedResources,
          [watchId]: {
            ...watch,
            callback
          }
        }
      });
    }

    return watchId;
  }
}
```

## Common Usage Pattern

```typescript
// 1. Get watcher instance
const watcher = await getAgentByName(env, 'SERVICE_MONITOR', 'main');

// 2. Add watches for different resources
// Watch website uptime
const uptimeWatch = await watcher.watch(
  {
    url: 'https://example.com',
    type: 'uptime',
    identifier: 'website'
  },
  {
    type: 'change' // Alert on any change
  },
  60000 // Check every minute
);

// Watch database size
const dbWatch = await watcher.watch(
  {
    type: 'database',
    identifier: 'db-size',
    metadata: { database: 'production' }
  },
  {
    type: 'threshold',
    value: 1000000000, // 1GB
    comparator: 'gt'
  },
  300000 // Check every 5 minutes
);

// 3. Monitor trigger history
setInterval(async () => {
  const history = await watcher.getTriggerHistory(5);
  if (history.length > 0) {
    console.log('Recent triggers:');
    history.forEach(t => {
      console.log(`  ${t.watchId}: ${t.oldValue} -> ${t.newValue}`);
    });
  }
}, 60000);

// 4. Check statistics
const stats = await watcher.getStats();
console.log(`Active watches: ${stats.activeWatches}`);
console.log(`Total checks: ${stats.totalChecks}`);
console.log(`Total triggers: ${stats.totalTriggers}`);

// 5. Stop watching when no longer needed
await watcher.stopWatching(uptimeWatch);
```

## File System Watcher Example

```typescript
class FileWatcher extends WatcherAgent<Env, WatcherAgentState> {
  protected override async fetchResourceValue(resource: Resource): Promise<unknown> {
    if (resource.type === 'file') {
      // Fetch file from R2, S3, or other storage
      const r2 = (this.env as any).R2_BUCKET;
      const object = await r2.get(resource.identifier);

      if (!object) return null;

      // Return file hash or size
      return {
        size: object.size,
        etag: object.etag,
        lastModified: object.uploaded
      };
    }

    return null;
  }

  @callable()
  async watchFile(
    bucketKey: string,
    checkIntervalMs: number = 60000
  ): Promise<string> {
    return this.watch(
      {
        type: 'file',
        identifier: bucketKey
      },
      {
        type: 'change' // Trigger on any change to file
      },
      checkIntervalMs
    );
  }
}

// Usage
const watcher = await getAgentByName(env, 'FILE_WATCHER', 'main');

await watcher.watchFile('configs/app.json', 30000);
await watcher.watchFile('data/export.csv', 60000);
```

## Metric Aggregation Watcher

```typescript
class MetricsWatcher extends WatcherAgent<Env, WatcherAgentState> {
  protected override async fetchResourceValue(resource: Resource): Promise<unknown> {
    if (resource.type === 'analytics') {
      // Fetch metrics from analytics service
      const response = await fetch(resource.url!);
      const data = await response.json();

      // Return aggregated metric
      return {
        requests: data.totalRequests,
        errors: data.errorCount,
        errorRate: (data.errorCount / data.totalRequests) * 100,
        avgResponseTime: data.avgResponseTime
      };
    }

    return null;
  }

  protected override evaluateCondition(
    condition: Condition,
    oldValue: unknown,
    newValue: unknown
  ): boolean {
    if (condition.type === 'metric-threshold') {
      const metrics = newValue as any;
      const metricName = condition.value as string;
      const threshold = (condition as any).threshold;

      return metrics[metricName] > threshold;
    }

    return super.evaluateCondition(condition, oldValue, newValue);
  }

  @callable()
  async watchMetric(
    metricUrl: string,
    metricName: string,
    threshold: number
  ): Promise<string> {
    return this.watch(
      {
        url: metricUrl,
        type: 'analytics',
        identifier: `metric-${metricName}`
      },
      {
        type: 'metric-threshold' as any,
        value: metricName,
        threshold
      } as any,
      60000
    );
  }
}
```

## Multi-Condition Watcher

```typescript
class AdvancedWatcher extends WatcherAgent<Env, WatcherAgentState> {
  @callable()
  async watchWithMultipleConditions(
    resource: Resource,
    conditions: Condition[]
  ): Promise<string> {
    const watchId = await this.watch(
      resource,
      conditions[0], // Primary condition
      60000
    );

    // Store additional conditions in metadata
    const watch = this.state.watchedResources[watchId];
    if (watch) {
      this.setState({
        ...this.state,
        watchedResources: {
          ...this.state.watchedResources,
          [watchId]: {
            ...watch,
            metadata: {
              ...watch.resource.metadata,
              additionalConditions: conditions.slice(1)
            }
          }
        }
      });
    }

    return watchId;
  }

  protected override async checkResource(watch: WatchedResource): Promise<void> {
    const currentValue = await this.fetchResourceValue(watch.resource);

    // Check primary condition
    const primaryTriggered = this.evaluateCondition(
      watch.condition,
      watch.lastValue,
      currentValue
    );

    // Check additional conditions
    const additionalConditions = watch.resource.metadata?.additionalConditions as Condition[];
    let allConditionsMet = primaryTriggered;

    if (additionalConditions && allConditionsMet) {
      for (const condition of additionalConditions) {
        if (!this.evaluateCondition(condition, watch.lastValue, currentValue)) {
          allConditionsMet = false;
          break;
        }
      }
    }

    if (allConditionsMet) {
      this.log(`All conditions met for ${watch.resource.identifier}`);
      this.recordTrigger(watch.id, watch.lastValue, currentValue);

      if (watch.callback) {
        const method = (this as any)[watch.callback];
        if (typeof method === 'function') {
          await method.call(this, watch, currentValue);
        }
      }
    }

    // Update watch
    const updatedWatch = {
      ...watch,
      lastCheckedAt: Date.now(),
      lastValue: currentValue,
      triggerCount: allConditionsMet ? watch.triggerCount + 1 : watch.triggerCount
    };

    this.setState({
      ...this.state,
      watchedResources: {
        ...this.state.watchedResources,
        [watch.id]: updatedWatch
      },
      stats: {
        ...this.state.stats,
        totalChecks: this.state.stats.totalChecks + 1
      }
    });
  }
}
```

## Integration with Notification System

```typescript
class NotifyingWatcher extends WatcherAgent<Env, WatcherAgentState> {
  protected override async checkResource(watch: WatchedResource): Promise<void> {
    await super.checkResource(watch);

    // Check if triggered recently
    const recentTriggers = this.state.triggerHistory
      .filter(t => t.watchId === watch.id)
      .filter(t => Date.now() - t.triggeredAt < 300000); // Last 5 minutes

    if (recentTriggers.length > 0) {
      // Send notification
      await this.sendNotification(watch, recentTriggers[0]);
    }
  }

  private async sendNotification(
    watch: WatchedResource,
    trigger: any
  ): Promise<void> {
    const message = `Alert: ${watch.resource.identifier} triggered\n` +
      `Old value: ${trigger.oldValue}\n` +
      `New value: ${trigger.newValue}`;

    // Send to Slack, email, SMS, etc.
    await fetch('https://hooks.slack.com/services/YOUR/WEBHOOK/URL', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        channel: '#alerts'
      })
    });
  }
}
```

## Best Practices

1. **Set appropriate intervals** - Don't check too frequently
2. **Handle fetch errors** - Resources may be temporarily unavailable
3. **Use meaningful identifiers** - Make resources easy to identify
4. **Implement callbacks** - Automate responses to triggers
5. **Monitor trigger rates** - Frequent triggers may indicate issues
6. **Clean up old watches** - Remove watches no longer needed
7. **Rate limit external requests** - Avoid overwhelming services
8. **Store trigger history** - Useful for debugging and analysis

## Performance Considerations

- Watches are checked sequentially using alarms
- Only one alarm active at a time (earliest check)
- Trigger history limited to last 1000 entries
- External fetch calls may add latency
- All state stored in durable storage
- Consider caching frequently accessed resources
- Batch similar checks when possible
