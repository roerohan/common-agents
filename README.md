# Common Agents Framework

[![npm version](https://badge.fury.io/js/common-agents.svg)](https://www.npmjs.com/package/common-agents)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-ready multi-agent framework built on top of the [Cloudflare Agents SDK](https://github.com/cloudflare/agents). Available on [npm](https://www.npmjs.com/package/common-agents) as `common-agents`.

```bash
npm install common-agents
```

## Why Multi-Agent Architecture?

In real life, complex organizations don't assign all responsibilities to a single person. Instead, different people are assigned different roles based on their expertise and responsibilities. A surgeon doesn't file insurance paperwork. A security guard doesn't design building blueprints. A chef doesn't handle restaurant finances. Each role has clear boundaries, specific responsibilities, and specialized knowledge.

The same principle applies to software architecture. **Instead of one monolithic agent doing all the work and having all the knowledge, we build an army of specialized agents**, each with a specific purpose.

### Key Benefits of Separation

**🔒 Security & Isolation**
- Each agent operates in its own isolated context
- Compromised agents don't expose the entire system
- Fine-grained access control and permissions
- Secrets and credentials scoped to specific agents

**🎯 Separation of Concerns**
- Single responsibility principle at the agent level
- Easier to understand, test, and maintain
- Clear boundaries between different parts of your system
- Changes to one agent don't cascade to others

**⚡ Scalability & Performance**
- Ephemeral agents self-destruct after completing tasks
- Permanent agents maintain long-lived state
- Horizontal scaling through worker pools
- Resource allocation based on actual needs

**🔄 Flexibility & Reusability**
- Agents can be composed in different workflows
- Swap implementations without changing interfaces
- Common patterns packaged as reusable base classes
- Mix and match agents for different use cases

## Agent Types: Permanent vs Ephemeral

The framework provides two fundamental categories of agents:

### Permanent Agents (Long-Lived)

Permanent agents maintain durable state and live indefinitely. They're ideal for:
- Coordinating workflows and aggregating results
- Routing requests to appropriate handlers
- Managing worker pools and task distribution
- Scheduling recurring tasks
- Storing shared knowledge and data
- Monitoring resources and triggering actions

**Examples**: CoordinatorAgent, RouterAgent, FleetManagerAgent, SchedulerAgent, KnowledgeBaseAgent

### Ephemeral Agents (Self-Destructing)

Ephemeral agents are created for specific tasks and self-destruct after completion. They're ideal for:
- Processing individual units of work in isolation
- Executing tasks that shouldn't persist
- Minimizing resource usage
- Ensuring clean slate for each execution
- Parallel processing with automatic cleanup

**Examples**: WorkerAgent, TaskProcessorAgent, LLMToolAgent, PipelineStageAgent

## Quick Start

```typescript
import { WorkerAgent, CoordinatorAgent, getAgentByName } from 'common-agents';

// 1. Define a worker that processes tasks
class DataWorker extends WorkerAgent {
  protected async processTask(task) {
    const result = await this.processData(task.data);
    return result;
  }
}

// 2. Define a coordinator that aggregates results
class DataCoordinator extends CoordinatorAgent {
  // Inherits result aggregation, querying, and statistics
}

// 3. Use your agents
const worker = await getAgentByName(env.DATA_WORKER, 'worker-1');
const coordinator = await getAgentByName(env.DATA_COORDINATOR, 'default');

// Worker processes task and reports to coordinator
await worker.executeTask(task);

// Query aggregated results
const summary = await coordinator.getSummary();
```

See the [examples/](./examples/) directory for complete, runnable examples.

## Agent Documentation

### Core Agents (Start Here)

**[WorkerAgent](./docs/WorkerAgent.md)** - Ephemeral agent that executes a single task and self-destructs. The simplest building block for parallel processing.

**[CoordinatorAgent](./docs/CoordinatorAgent.md)** - Permanent agent that aggregates results from multiple workers and provides query APIs.

**[FleetManagerAgent](./docs/FleetManagerAgent.md)** - Permanent agent that spawns and manages pools of workers with concurrency control.

### Routing & Scheduling

**[RouterAgent](./docs/RouterAgent.md)** - Permanent agent that routes incoming requests to appropriate handlers based on configurable rules.

**[SchedulerAgent](./docs/SchedulerAgent.md)** - Permanent agent that schedules and executes tasks at specific times using Cloudflare alarms.

### Data & State Management

**[KnowledgeBaseAgent](./docs/KnowledgeBaseAgent.md)** - Permanent agent that stores and retrieves domain knowledge with search capabilities.

**[QueueAgent](./docs/QueueAgent.md)** - Permanent agent that manages task queues with priority ordering and dead letter queue support.

**[WatcherAgent](./docs/WatcherAgent.md)** - Permanent agent that monitors external resources and triggers actions when conditions are met.

### Advanced Processing

**[TaskProcessorAgent](./docs/TaskProcessorAgent.md)** - Ephemeral agent that handles complex multi-step tasks with progress tracking and pause/resume.

**[LLMToolAgent](./docs/LLMToolAgent.md)** - Ephemeral agent for LLM API integration with conversation history and tool calling support.

**[PipelineStageAgent](./docs/PipelineStageAgent.md)** - Ephemeral agent that executes one stage in a multi-stage data processing pipeline.

## Examples

The framework includes three complete, production-ready examples:

### [Email Processing Pipeline](./examples/email-processing/)
Router → Fleet Manager → Workers → Coordinator pattern for parallel email processing.

### [LLM Document Summarization](./examples/llm-summarization/)
Fan-out/fan-in pattern with parallel LLM agents for document chunking and synthesis.

### [Scheduled Data Pipeline](./examples/scheduled-pipeline/)
ETL pipeline with sequential stages triggered by scheduled alarms.

Each example includes:
- Complete TypeScript implementation
- Wrangler configuration for local development and deployment
- API endpoints for testing
- Comprehensive documentation

## Installation

Install from npm:

```bash
npm install common-agents
```

Or with pnpm:

```bash
pnpm add common-agents
```

**Requirements:**
- Node.js >= 18.0.0
- TypeScript >= 5.0.0
- Cloudflare account (for deployment)

## Architecture

Built on [Cloudflare Agents SDK](https://github.com/cloudflare/agents), this framework provides:

- **Type-safe base classes** for common agent patterns
- **Lifecycle management** with hooks for initialization, cleanup, and error handling
- **Built-in utilities** for retry logic, ID generation, and error handling
- **Production-ready patterns** for coordination, routing, scheduling, and more
- **Complete examples** demonstrating real-world workflows

See [FRAMEWORK.md](./FRAMEWORK.md) for comprehensive architectural documentation.

## Features

✅ **Minimal Boilerplate** - Extend base classes instead of reimplementing infrastructure
✅ **Type-Safe** - Full TypeScript support with comprehensive type definitions
✅ **Production-Ready** - Error handling, retries, metrics, and lifecycle management built-in
✅ **Well-Documented** - Detailed docs for every agent type with examples
✅ **Battle-Tested Patterns** - Proven patterns for common multi-agent workflows
✅ **Cloudflare Native** - Built specifically for Cloudflare Workers and Durable Objects

## Contributing

Contributions are welcome! Please:

1. Follow existing code patterns
2. Add tests for new functionality
3. Update documentation
4. Ensure TypeScript types are correct

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Links

- **npm Package**: [common-agents](https://www.npmjs.com/package/common-agents)
- **Documentation**: [docs/](./docs/)
- **Examples**: [examples/](./examples/)
- **Framework Guide**: [FRAMEWORK.md](./FRAMEWORK.md)
- **Cloudflare Agents SDK**: [GitHub](https://github.com/cloudflare/agents) | [Docs](https://developers.cloudflare.com/agents/)

