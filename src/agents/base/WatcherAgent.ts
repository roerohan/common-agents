import { BaseAgent, BaseAgentState } from "./BaseAgent";
import { callable } from "agents";
import { generateWatchId } from "../../utils/id";

export interface Resource {
  url?: string;
  type: string;
  identifier: string;
  metadata?: Record<string, unknown>;
}

export interface Condition {
  type: "change" | "threshold" | "pattern";
  value?: unknown;
  comparator?: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "contains";
}

export interface WatchedResource {
  id: string;
  resource: Resource;
  condition: Condition;
  checkIntervalMs: number;
  lastCheckedAt?: number;
  lastValue?: unknown;
  triggerCount: number;
  enabled: boolean;
  callback?: string;
}

export interface WatcherAgentState extends BaseAgentState {
  watchedResources: Record<string, WatchedResource>;
  triggerHistory: Array<{
    watchId: string;
    triggeredAt: number;
    oldValue?: unknown;
    newValue?: unknown;
  }>;
  stats: {
    totalWatches: number;
    activeWatches: number;
    totalTriggers: number;
    totalChecks: number;
  };
}

export class WatcherAgent<
  TEnv = unknown,
  TState extends WatcherAgentState = WatcherAgentState
> extends BaseAgent<TEnv, TState> {
  override initialState: TState = {
    created: Date.now(),
    lastUpdated: Date.now(),
    metadata: {},
    watchedResources: {},
    triggerHistory: [],
    stats: {
      totalWatches: 0,
      activeWatches: 0,
      totalTriggers: 0,
      totalChecks: 0,
    },
  } as unknown as TState;

  override initialize(): void {
    super.initialize();
    this.log(`Initialized with ${Object.keys(this.state.watchedResources).length} watched resources`);
    this.scheduleNextCheck();
  }

  @callable()
  async watch(
    resource: Resource,
    condition: Condition,
    checkIntervalMs: number = 60000
  ): Promise<string> {
    const watchId = generateWatchId();

    const watch: WatchedResource = {
      id: watchId,
      resource,
      condition,
      checkIntervalMs,
      triggerCount: 0,
      enabled: true,
    };

    this.setState({
      ...this.state,
      watchedResources: {
        ...this.state.watchedResources,
        [watchId]: watch,
      },
      stats: {
        ...this.state.stats,
        totalWatches: this.state.stats.totalWatches + 1,
        activeWatches: this.state.stats.activeWatches + 1,
      },
    });

    this.log(`Started watching: ${resource.identifier} (${watchId})`);
    this.scheduleNextCheck();

    return watchId;
  }

  @callable()
  async stopWatching(watchId: string): Promise<boolean> {
    const watch = this.state.watchedResources[watchId];
    if (!watch) {
      return false;
    }

    const { [watchId]: removed, ...remaining } = this.state.watchedResources;

    this.setState({
      ...this.state,
      watchedResources: remaining,
      stats: {
        ...this.state.stats,
        activeWatches: this.state.stats.activeWatches - 1,
      },
    });

    this.log(`Stopped watching: ${watchId}`);
    return true;
  }

  @callable()
  async getWatchedResources(): Promise<WatchedResource[]> {
    return Object.values(this.state.watchedResources);
  }

  @callable()
  async getTriggerHistory(limit?: number): Promise<WatcherAgentState["triggerHistory"]> {
    const history = this.state.triggerHistory;
    return limit ? history.slice(-limit) : history;
  }

  @callable()
  async getStats(): Promise<WatcherAgentState["stats"]> {
    return this.state.stats;
  }

  override alarm = async (): Promise<void> => {
    this.log("Alarm triggered, checking watched resources");

    const now = Date.now();
    const watches = Object.values(this.state.watchedResources).filter(
      (w) => w.enabled
    );

    for (const watch of watches) {
      const shouldCheck =
        !watch.lastCheckedAt ||
        now - watch.lastCheckedAt >= watch.checkIntervalMs;

      if (shouldCheck) {
        await this.checkResource(watch);
      }
    }

    this.scheduleNextCheck();
  };

  protected async checkResource(watch: WatchedResource): Promise<void> {
    this.log(`Checking resource: ${watch.resource.identifier}`);

    const currentValue = await this.fetchResourceValue(watch.resource);

    // Update last checked time
    const updatedWatch = {
      ...watch,
      lastCheckedAt: Date.now(),
    };

    // Check condition
    if (this.evaluateCondition(watch.condition, watch.lastValue, currentValue)) {
      this.log(`Condition met for ${watch.resource.identifier}`);

      // Record trigger
      this.recordTrigger(watch.id, watch.lastValue, currentValue);

      // Update trigger count
      updatedWatch.triggerCount = watch.triggerCount + 1;

      // Execute callback if defined
      if (watch.callback) {
        const method = (this as any)[watch.callback];
        if (typeof method === "function") {
          await method.call(this, watch, currentValue);
        }
      }
    }

    // Update watch with new value
    updatedWatch.lastValue = currentValue;

    this.setState({
      ...this.state,
      watchedResources: {
        ...this.state.watchedResources,
        [watch.id]: updatedWatch,
      },
      stats: {
        ...this.state.stats,
        totalChecks: this.state.stats.totalChecks + 1,
      },
    });
  }

  protected async fetchResourceValue(resource: Resource): Promise<unknown> {
    // Override in subclasses to fetch actual resource value
    this.log(`Would fetch resource: ${resource.identifier}`);
    return null;
  }

  protected evaluateCondition(
    condition: Condition,
    oldValue: unknown,
    newValue: unknown
  ): boolean {
    switch (condition.type) {
      case "change":
        return oldValue !== newValue;
      case "threshold":
        if (!condition.comparator || condition.value === undefined) {
          return false;
        }
        return this.compare(newValue, condition.value, condition.comparator);
      case "pattern":
        if (typeof newValue === "string" && typeof condition.value === "string") {
          return newValue.includes(condition.value);
        }
        return false;
      default:
        return false;
    }
  }

  protected compare(a: unknown, b: unknown, comparator: string): boolean {
    switch (comparator) {
      case "eq":
        return a === b;
      case "ne":
        return a !== b;
      case "gt":
        return (a as number) > (b as number);
      case "lt":
        return (a as number) < (b as number);
      case "gte":
        return (a as number) >= (b as number);
      case "lte":
        return (a as number) <= (b as number);
      default:
        return false;
    }
  }

  protected recordTrigger(watchId: string, oldValue: unknown, newValue: unknown): void {
    const triggerHistory = [
      ...this.state.triggerHistory,
      {
        watchId,
        triggeredAt: Date.now(),
        oldValue,
        newValue,
      },
    ];

    // Keep only last 1000 triggers
    const trimmedHistory = triggerHistory.slice(-1000);

    this.setState({
      ...this.state,
      triggerHistory: trimmedHistory,
      stats: {
        ...this.state.stats,
        totalTriggers: this.state.stats.totalTriggers + 1,
      },
    });
  }

  protected scheduleNextCheck(): void {
    const watches = Object.values(this.state.watchedResources).filter(
      (w) => w.enabled
    );

    if (watches.length === 0) {
      this.log("No active watches");
      return;
    }

    // Find earliest next check time
    const now = Date.now();
    const nextCheckTimes = watches.map((w) => {
      const lastCheck = w.lastCheckedAt || now;
      return lastCheck + w.checkIntervalMs;
    });

    const nextCheckTime = Math.min(...nextCheckTimes);

    this.log(`Next check scheduled at ${new Date(nextCheckTime).toISOString()}`);
    this.schedule(new Date(nextCheckTime), "alarm", null);
  }
}
