# Common Agents Framework - Examples

This directory contains complete, runnable examples demonstrating the Common Agents Framework patterns described in FRAMEWORK.md.

## Examples

### 1. Email Processing Pipeline

**Path**: `email-processing/`

Demonstrates request routing and parallel worker processing:
- RouterAgent routes HTTP requests
- FleetManagerAgent spawns workers
- WorkerAgent processes individual emails
- CoordinatorAgent aggregates results

**Key Concepts**: Request routing, fan-out processing, result aggregation

[View Documentation](./email-processing/README.md)

---

### 2. LLM Document Summarization

**Path**: `llm-summarization/`

Demonstrates LLM-powered fan-out/fan-in pattern:
- Document chunking and parallel LLM processing
- Multiple LLMToolAgents summarize chunks simultaneously
- SynthesisAgent combines chunk summaries
- CoordinatorAgent manages the workflow

**Key Concepts**: Document chunking, parallel LLM calls, synthesis, fan-out/fan-in

[View Documentation](./llm-summarization/README.md)

---

### 3. Scheduled Data Pipeline

**Path**: `scheduled-pipeline/`

Demonstrates scheduled ETL pipeline with sequential stages:
- SchedulerAgent triggers pipeline on schedule (alarms)
- PipelineStageAgents execute Extract → Transform → Load
- CoordinatorAgent stores execution history
- Automatic recurring execution

**Key Concepts**: Scheduled tasks, alarms, sequential processing, ETL pipeline

[View Documentation](./scheduled-pipeline/README.md)

---

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm (recommended) or npm
- Wrangler CLI (installed automatically with pnpm install)

### Installation

From the repository root:

```bash
# Install all dependencies
pnpm install

# Build the framework
pnpm build
```

### Running Examples

Each example can be run independently:

```bash
# Email processing
cd examples/email-processing
pnpm dev

# LLM summarization
cd examples/llm-summarization
pnpm dev

# Scheduled pipeline
cd examples/scheduled-pipeline
pnpm dev
```

### Testing Examples

#### Email Processing

```bash
# Process email batch
curl -X POST http://localhost:8787/api/emails/process \
  -H "Content-Type: application/json" \
  -d '{"emails": [...]}'

# Get results
curl http://localhost:8787/api/emails/results

# Get summary
curl http://localhost:8787/api/emails/summary
```

#### LLM Summarization

```bash
# Summarize document
curl -X POST http://localhost:8787/api/summarize \
  -H "Content-Type: application/json" \
  -d '{"document": {"id": "doc-1", "text": "Long document text..."}}'

# Get summary
curl http://localhost:8787/api/summary
```

#### Scheduled Pipeline

```bash
# Trigger pipeline manually
curl -X POST http://localhost:8787/api/pipeline/trigger

# Get last execution
curl http://localhost:8787/api/pipeline/last

# Get execution history
curl http://localhost:8787/api/pipeline/history

# Get scheduled tasks
curl http://localhost:8787/api/pipeline/schedule
```

## Deployment

Each example can be deployed independently to Cloudflare Workers:

```bash
cd examples/<example-name>
pnpm deploy
```

## Workspace Structure

This examples directory is configured as a pnpm workspace:

```
common-agents/
├── pnpm-workspace.yaml          # Workspace configuration
├── package.json                  # Root package
├── src/                          # Framework source
└── examples/
    ├── email-processing/
    │   ├── package.json          # Example-specific dependencies
    │   ├── wrangler.toml         # Cloudflare Workers config
    │   ├── tsconfig.json         # TypeScript config
    │   └── src/index.ts          # Example implementation
    ├── llm-summarization/
    │   └── ...
    └── scheduled-pipeline/
        └── ...
```

Each example:
- Is a separate pnpm workspace package
- Has its own `wrangler.toml` for deployment
- References `common-agents` via `workspace:*`
- Can be run and deployed independently

## Agent Types Used

### Email Processing
- ✅ RouterAgent (Permanent)
- ✅ FleetManagerAgent (Permanent)
- ✅ WorkerAgent (Ephemeral)
- ✅ CoordinatorAgent (Permanent)

### LLM Summarization
- ✅ LLMToolAgent (Ephemeral)
- ✅ FleetManagerAgent (Permanent)
- ✅ CoordinatorAgent (Permanent)

### Scheduled Pipeline
- ✅ SchedulerAgent (Permanent)
- ✅ PipelineStageAgent (Ephemeral)
- ✅ CoordinatorAgent (Permanent)

## Development

### Type Checking

```bash
# Check types in all examples
pnpm typecheck

# Or per example
cd examples/email-processing
pnpm typecheck
```

### Building

```bash
# Build framework (from root)
cd ../..
pnpm build

# Build example
cd examples/email-processing
pnpm build
```

## Learn More

- [Framework Documentation](../FRAMEWORK.md)
- [Agent API Documentation](../docs/)
- [Common Agents README](../README.md)

## Support

For issues or questions:
- Check the [FRAMEWORK.md](../FRAMEWORK.md) for architectural details
- Review agent-specific docs in [docs/](../docs/)
- Open an issue on GitHub
