# Introduction

`common-agents` is a production-ready multi-agent framework built on top of the [Cloudflare Agents SDK](https://github.com/cloudflare/agents). Available on [npm](https://www.npmjs.com/package/common-agents) as `common-agents`.

This directory contains detailed documentation for each agent type in the Common Agents Framework.

## Why Delegate to Different Agent Types?

In complex systems, attempting to handle everything with a single agent quickly becomes unmanageable. Just as a hospital doesn't assign all tasks to one person, your application shouldn't rely on one monolithic agent to handle coordination, task execution, routing, scheduling, and data storage.

**The key insight: Different responsibilities require different lifecycles and capabilities.**

- **Coordination tasks** need persistent state to aggregate results over time
- **Task execution** should be isolated and ephemeral to prevent resource leaks
- **Routing logic** needs to maintain rules and configuration persistently
- **Worker pools** must spawn and manage short-lived workers dynamically
- **Scheduled operations** require durable alarms that survive restarts

By delegating to specialized agent types, you get:
- **Clear separation of concerns** - Each agent has one job and does it well
- **Appropriate lifecycles** - Permanent agents for state, ephemeral for tasks
- **Resource efficiency** - Workers self-destruct after completion
- **Easier debugging** - Problems are isolated to specific agent types
- **Better scalability** - Scale workers independently from coordinators

> **Further Learning**: For a deeper exploration of why putting components in well-defined "boxes" leads to more reliable systems, watch Kenton Varda's talk: [Let's put the AI in lots of little boxes](https://www.youtube.com/watch?v=xUj4HQt_leg) (Cloudflare Connect 2025).

## Configuration & Setup

### Registering Agents in `wrangler.toml`

Before you can use agents in your application, they must be registered in your `wrangler.toml` configuration file. Each agent needs a **binding** (the environment variable name) and a **class_name** (the TypeScript class).

```toml
[[agents]]
binding = "MY_AGENT"
class_name = "MyAgentClass"

[[agents]]
binding = "DATA_WORKER"
class_name = "DataWorker"

[[agents]]
binding = "COORDINATOR"
class_name = "DataCoordinator"
```

**How it works:**
1. The `binding` defines the environment variable name that will be available in your code
2. The `class_name` must match the exported class name in your TypeScript code
3. Cloudflare automatically creates an `AgentNamespace` for each binding
4. You access agents via `env.MY_AGENT`, `env.DATA_WORKER`, etc.

**Example:**
```typescript
// In your TypeScript code
interface Env {
  MY_AGENT: AgentNamespace<MyAgentClass>;
  DATA_WORKER: AgentNamespace<DataWorker>;
  COORDINATOR: AgentNamespace<DataCoordinator>;
}

// Access agents using getAgentByName
const agent = await getAgentByName(env.MY_AGENT, 'instance-id');
const result = await agent.someMethod();
```

For more details on Cloudflare Agents configuration, see the [Cloudflare Agents documentation](https://developers.cloudflare.com/agents/).

## Agent Types

The framework provides two fundamental categories of agents:

### Permanent Agents (Long-Lived)

Permanent agents maintain durable state and live indefinitely. They're ideal for:
- Coordinating workflows and aggregating results
- Routing requests to appropriate handlers
- Managing worker pools and task distribution
- Scheduling recurring tasks
- Storing shared knowledge and data
- Monitoring resources and triggering actions

**Available Permanent Agents:**
- **[CoordinatorAgent](./CoordinatorAgent.md)** - Aggregates results from multiple workers and provides query APIs
- **[RouterAgent](./RouterAgent.md)** - Routes incoming requests to appropriate handlers based on configurable rules
- **[FleetManagerAgent](./FleetManagerAgent.md)** - Spawns and manages pools of workers with concurrency control
- **[SchedulerAgent](./SchedulerAgent.md)** - Schedules and executes tasks at specific times using Cloudflare alarms
- **[KnowledgeBaseAgent](./KnowledgeBaseAgent.md)** - Stores and retrieves domain knowledge with search capabilities
- **[QueueAgent](./QueueAgent.md)** - Manages task queues with priority ordering and dead letter queue support
- **[WatcherAgent](./WatcherAgent.md)** - Monitors external resources and triggers actions when conditions are met

### Ephemeral Agents (Self-Destructing)

Ephemeral agents are created for specific tasks and self-destruct after completion. They're ideal for:
- Processing individual units of work in isolation
- Executing tasks that shouldn't persist
- Minimizing resource usage
- Ensuring clean slate for each execution
- Parallel processing with automatic cleanup

**Available Ephemeral Agents:**
- **[WorkerAgent](./WorkerAgent.md)** - Executes a single task and self-destructs (simplest building block)
- **[TaskProcessorAgent](./TaskProcessorAgent.md)** - Handles complex multi-step tasks with progress tracking and pause/resume
- **[LLMToolAgent](./LLMToolAgent.md)** - LLM API integration with conversation history and tool calling support
- **[PipelineStageAgent](./PipelineStageAgent.md)** - Executes one stage in a multi-stage data processing pipeline

## Quick Navigation

### Core Agents (Start Here)
- [WorkerAgent](./WorkerAgent.md) - Start here for parallel processing
- [CoordinatorAgent](./CoordinatorAgent.md) - Result aggregation and querying
- [FleetManagerAgent](./FleetManagerAgent.md) - Worker pool management

### Routing & Scheduling
- [RouterAgent](./RouterAgent.md) - Request routing
- [SchedulerAgent](./SchedulerAgent.md) - Task scheduling

### Data & State Management
- [KnowledgeBaseAgent](./KnowledgeBaseAgent.md) - Data storage and retrieval
- [QueueAgent](./QueueAgent.md) - Task queue management
- [WatcherAgent](./WatcherAgent.md) - Resource monitoring

### Advanced Processing
- [TaskProcessorAgent](./TaskProcessorAgent.md) - Complex multi-step tasks
- [LLMToolAgent](./LLMToolAgent.md) - LLM integration
- [PipelineStageAgent](./PipelineStageAgent.md) - Pipeline stages

## Additional Resources

- **Framework Guide**: [FRAMEWORK.md](../FRAMEWORK.md) - Architecture, patterns, and design principles
- **Examples**: [examples/](../examples/) - Complete, runnable examples
- **Main README**: [README.md](../README.md) - Getting started and overview
