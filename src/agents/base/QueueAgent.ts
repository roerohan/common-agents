import { BaseAgent, BaseAgentState } from "./BaseAgent";
import { callable } from "agents";
import { generateId } from "../../utils/id";

export interface QueueItem<T = unknown> {
  id: string;
  payload: T;
  priority: number;
  enqueuedAt: number;
  retries: number;
  metadata?: Record<string, unknown>;
}

export interface QueueAgentState extends BaseAgentState {
  queue: QueueItem[];
  deadLetterQueue: QueueItem[];
  stats: {
    totalEnqueued: number;
    totalDequeued: number;
    currentSize: number;
    deadLetterSize: number;
  };
}

export class QueueAgent<
  TEnv = unknown,
  TState extends QueueAgentState = QueueAgentState,
  T = unknown
> extends BaseAgent<TEnv, TState> {
  protected maxRetries = 3;

  override initialState: TState = {
    created: Date.now(),
    lastUpdated: Date.now(),
    metadata: {},
    queue: [],
    deadLetterQueue: [],
    stats: {
      totalEnqueued: 0,
      totalDequeued: 0,
      currentSize: 0,
      deadLetterSize: 0,
    },
  } as unknown as TState;

  @callable()
  async enqueue(payload: T, priority: number = 0): Promise<string> {
    const item: QueueItem<T> = {
      id: generateId("queue-item"),
      payload,
      priority,
      enqueuedAt: Date.now(),
      retries: 0,
    };

    const queue = [...this.state.queue, item].sort((a, b) => b.priority - a.priority);

    this.setState({
      ...this.state,
      queue,
      stats: {
        ...this.state.stats,
        totalEnqueued: this.state.stats.totalEnqueued + 1,
        currentSize: queue.length,
      },
    });

    this.log(`Enqueued item: ${item.id} (priority: ${priority})`);
    return item.id;
  }

  @callable()
  async dequeueItem(): Promise<QueueItem<T> | null> {
    if (this.state.queue.length === 0) {
      return null;
    }

    const [item, ...remaining] = this.state.queue;

    this.setState({
      ...this.state,
      queue: remaining,
      stats: {
        ...this.state.stats,
        totalDequeued: this.state.stats.totalDequeued + 1,
        currentSize: remaining.length,
      },
    });

    this.log(`Dequeued item: ${item!.id}`);
    return item as QueueItem<T>;
  }

  @callable()
  async peek(): Promise<QueueItem<T> | null> {
    return this.state.queue[0] as QueueItem<T> || null;
  }

  @callable()
  async getQueueLength(): Promise<number> {
    return this.state.queue.length;
  }

  @callable()
  async moveToDeadLetter(itemId: string): Promise<boolean> {
    const itemIndex = this.state.queue.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) {
      return false;
    }

    const item = this.state.queue[itemIndex];
    const newQueue = this.state.queue.filter((i) => i.id !== itemId);
    const newDLQ = [...this.state.deadLetterQueue, item!];

    this.setState({
      ...this.state,
      queue: newQueue,
      deadLetterQueue: newDLQ,
      stats: {
        ...this.state.stats,
        currentSize: newQueue.length,
        deadLetterSize: newDLQ.length,
      },
    });

    this.log(`Moved to dead letter queue: ${itemId}`);
    return true;
  }

  @callable()
  async getDeadLetterQueue(): Promise<QueueItem<T>[]> {
    return this.state.deadLetterQueue as QueueItem<T>[];
  }

  @callable()
  async clearQueue(): Promise<void> {
    this.setState({
      ...this.state,
      queue: [],
      stats: {
        ...this.state.stats,
        currentSize: 0,
      },
    });
    this.log("Queue cleared");
  }

  @callable()
  async getStats(): Promise<QueueAgentState["stats"]> {
    return this.state.stats;
  }
}
