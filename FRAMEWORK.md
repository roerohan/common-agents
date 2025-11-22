# Common Agents Framework Guide

This guide provides a high-level overview of the Common Agents Framework architecture, patterns, and design principles.

## Core Concepts

### Agent Permanence

The framework distinguishes between two fundamental types of agents:

**Permanent Agents** - Long-lived agents that maintain durable state indefinitely:
- CoordinatorAgent - Aggregates results from multiple workers
- FleetManagerAgent - Manages pools of worker agents
- RouterAgent - Routes requests to appropriate handlers
- SchedulerAgent - Executes tasks on schedules using alarms
- KnowledgeBaseAgent - Stores and retrieves domain knowledge
- QueueAgent - Manages task queues with priority ordering
- WatcherAgent - Monitors resources and triggers actions

**Ephemeral Agents** - Short-lived agents that self-destruct after completion:
- WorkerAgent - Executes a single task and terminates
- TaskProcessorAgent - Handles complex multi-step tasks
- LLMToolAgent - Integrates with LLM APIs
- PipelineStageAgent - Executes one stage in a pipeline

## Lifecycle Models

### Permanent Agent Lifecycle

```
┌─────────────┐
│   Created   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ initialize()│ ← Load durable state
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Ready (Idle)   │ ◄─┐
└──────┬──────────┘   │
       │              │
       ▼              │
┌─────────────────┐   │
│ Handle Request  │   │
└──────┬──────────┘   │
       │              │
       ▼              │
┌─────────────────┐   │
│  Save State     │   │
└──────┬──────────┘   │
       │              │
       └──────────────┘

Persists indefinitely unless explicitly destroyed
```

**Key Characteristics:**
- State survives between invocations
- Can be awakened by HTTP requests, alarms, or other agents
- No automatic cleanup
- Ideal for coordination, routing, scheduling, and data storage

### Ephemeral Agent Lifecycle

```
┌─────────────┐
│   Spawned   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ initialize()│ ← Receive task config
└──────┬──────┘
       │
       ▼
┌──────────────┐
│onBeforeTask()│
└──────┬───────┘
       │
       ▼
┌─────────────┐
│ Execute Task│
└──────┬──────┘
       │
       ▼
┌──────────────┐
│ onAfterTask()│
└──────┬───────┘
       │
       ▼
┌─────────────┐
│  cleanup()  │ ← Send results, clear state
└──────┬──────┘
       │
       ▼
┌─────────────┐
│state.reset()│ ← Self-destruct
└─────────────┘
```

**Key Characteristics:**
- No durable state persists after completion
- Automatically cleans up resources
- Minimizes resource usage
- Ideal for isolated, parallelizable tasks

## Common Workflow Patterns

### Pattern 1: Fan-Out/Fan-In Processing

```
External Request → CoordinatorAgent → FleetManagerAgent → WorkerAgent (N instances)
                          ↑                                      ↓
                          └────────── (collect results) ─────────┘
```

**Use Cases:**
- Parallel processing of independent tasks
- Batch data processing
- Document chunking and analysis

**Example:** Email processing, document summarization, data transformation batches

### Pattern 2: Request Routing

```
External HTTP → RouterAgent → [Target Agent A]
                            → [Target Agent B]
                            → [Target Agent C]
```

**Use Cases:**
- Multi-tenant systems
- API versioning
- Dynamic workload distribution
- A/B testing

**Example:** Route requests to different handlers based on path, headers, or payload

### Pattern 3: Scheduled Pipelines

```
SchedulerAgent (alarm) → PipelineCoordinator → Sequential Stages
                                                ├─ ExtractStage
                                                ├─ TransformStage
                                                └─ LoadStage
                                                     ↓
                         CoordinatorAgent ← (store results)
```

**Use Cases:**
- ETL workflows
- Periodic data processing
- Scheduled reports
- Cleanup jobs

**Example:** Daily data pipeline, hourly metrics aggregation

### Pattern 4: Knowledge-Augmented Processing

```
External Request → WorkerAgent ─┬→ KnowledgeBaseAgent (query context)
                                │
                                └→ LLMToolAgent (process with context)
                                       ↓
                   CoordinatorAgent ← (collect results)
```

**Use Cases:**
- RAG (Retrieval-Augmented Generation)
- Context-aware processing
- Cached data retrieval

**Example:** LLM agents querying knowledge base for relevant context

## State Management

### Permanent Agents

```typescript
// State persists across invocations
async submitResult(result: TaskResult): Promise<void> {
  this.setState({
    ...this.state,
    results: [...this.state.results, result]
  });
  // State automatically persisted to durable storage
}
```

**Best Practices:**
- Keep state minimal and well-structured
- Use `setState()` for all state updates
- State survives restarts and hibernation
- Avoid storing large blobs directly in state

### Ephemeral Agents

```typescript
// Use instance variables for temporary data
private taskData: TaskData | null = null;

async executeTask(task: Task): Promise<TaskResult> {
  this.taskData = { /* temporary data */ };

  try {
    const result = await this.processTask(task);
    await this.sendResult(result);
    return result;
  } finally {
    await this.cleanup();
    await this.state.reset(); // Self-destruct
  }
}
```

**Best Practices:**
- Don't persist state - use local variables
- Always call `cleanup()` before `state.reset()`
- Send results before self-destructing
- Close connections and release resources in `cleanup()`

## Communication Patterns

### Direct Invocation

```typescript
const targetAgent = await getAgentByName(env.TARGET_AGENT, 'instance-id');
const result = await targetAgent.someMethod(args);
```

**Use Cases:**
- Synchronous communication
- Direct method calls
- Simple request/response

### Result Submission

```typescript
// Worker reports to coordinator
const coordinator = await getAgentByName(env.COORDINATOR, 'default');
await coordinator.submitResult(this.getWorkerId(), result);
```

**Use Cases:**
- Asynchronous result collection
- Fan-in patterns
- Progress tracking

### Queue-Based

```typescript
// Producer
const queue = await getAgentByName(env.QUEUE, 'default');
await queue.enqueue(task, priority);

// Consumer
const task = await queue.dequeue();
```

**Use Cases:**
- Decoupled processing
- Rate limiting
- Backpressure management

## Scaling Patterns

### Horizontal Scaling

FleetManagerAgent automatically scales workers:

```typescript
// Process 1000 tasks with max 10 concurrent workers
const tasks = generateTasks(1000);
const batchId = await fleetManager.submitBatch(tasks);

// Workers are spawned, process tasks, and self-destruct
// Fleet manager handles concurrency limits
```

### Dynamic Scaling

```typescript
// Adjust concurrency based on load
await fleetManager.scaleWorkers(20); // Scale up
await fleetManager.scaleWorkers(5);  // Scale down
```

## Error Handling

### Built-in Retry Logic

```typescript
import { retry } from 'common-agents';

await retry(
  async () => await unreliableOperation(),
  {
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2
  }
);
```

### Task-Level Retries

FleetManagerAgent supports automatic task retries:

```typescript
await fleetManager.updateConfig({
  retryFailedTasks: true,
  maxRetries: 3
});
```

## Security & Isolation

### Agent Isolation

Each agent operates in its own isolated context:

```typescript
// Agent A cannot directly access Agent B's state
// Communication only through defined methods
const agentB = await getAgentByName(env.AGENT_B, 'instance');
const result = await agentB.publicMethod(); // OK
// agentB.state.data = ... // Not accessible
```

### Credential Scoping

```typescript
// Each agent can have its own credentials
class MyWorker extends WorkerAgent {
  protected async processTask(task: Task) {
    // Access credentials scoped to this agent type
    const apiKey = this.env.MY_WORKER_API_KEY;
    // ...
  }
}
```

## Best Practices

### 1. Choose the Right Agent Type

- **Use Permanent Agents** for coordination, routing, scheduling, storage
- **Use Ephemeral Agents** for isolated tasks, parallel processing, one-time operations

### 2. Design for Failure

- Implement proper error handling in `processTask()`
- Use retry logic for transient failures
- Report failures to coordinators for tracking
- Set appropriate timeouts

### 3. Clean Up Resources

```typescript
protected async cleanup(): Promise<void> {
  // Close connections
  await this.closeDB();

  // Cancel pending operations
  this.cancelTimers();

  // Release locks
  await this.releaseLocks();
}
```

### 4. Monitor and Observe

```typescript
// Use built-in metrics
const stats = await coordinator.getSummary();
console.log(`Success rate: ${stats.successCount / stats.totalResults}`);

// Track processing times
const metrics = await fleetManager.getStats();
console.log(`Active workers: ${metrics.activeWorkers}`);
```

### 5. Test Isolation

Each agent should be testable in isolation:

```typescript
// Test worker independently
const worker = new MyWorker();
const result = await worker.executeTask(mockTask);
expect(result.success).toBe(true);

// Test coordinator independently
const coordinator = new MyCoordinator();
await coordinator.submitResult('worker-1', mockResult);
const summary = await coordinator.getSummary();
```

## Example Workflows

See the [examples/](./examples/) directory for complete implementations:

1. **[Email Processing](./examples/email-processing/)** - Router → FleetManager → Workers → Coordinator
2. **[LLM Summarization](./examples/llm-summarization/)** - Document chunking with parallel LLM agents
3. **[Scheduled Pipeline](./examples/scheduled-pipeline/)** - ETL pipeline with sequential stages

## Additional Resources

- **Agent Documentation**: [docs/](./docs/) - Detailed documentation for each agent type
- **Quick Start**: [README.md](./README.md) - Getting started guide
- **Examples**: [examples/](./examples/) - Complete, runnable examples
- **Cloudflare Agents SDK**: [GitHub](https://github.com/cloudflare/agents) | [Docs](https://developers.cloudflare.com/agents/)

---

For implementation details and API references, see the individual agent documentation in [docs/](./docs/).
