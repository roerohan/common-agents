# Email Processing Example

This example demonstrates a complete email processing pipeline using the Common Agents Framework.

## Architecture

```
External HTTP → RouterAgent → FleetManagerAgent → EmailWorker (N instances)
                                                         ↓
                               EmailCoordinator ← (results)
```

## Flow

1. HTTP request with email batch → RouterAgent
2. Router routes to FleetManagerAgent
3. FleetManager spawns EmailWorker for each email
4. Workers process emails and extract summaries (sentiment, topics, priority)
5. Workers report results to CoordinatorAgent
6. Workers self-destruct
7. Client queries Coordinator for aggregated results

## Running Locally

```bash
# Install dependencies (from repo root)
pnpm install

# Start development server
cd examples/email-processing
pnpm dev
```

## API Endpoints

### Process Email Batch

```bash
curl -X POST http://localhost:8787/api/emails/process \
  -H "Content-Type: application/json" \
  -d '{
    "emails": [
      {
        "id": "email-1",
        "type": "process-email",
        "data": {
          "from": "alice@example.com",
          "to": "bob@example.com",
          "subject": "Urgent: Project Update",
          "body": "We need to discuss the critical issues with the project deadline...",
          "timestamp": 1700000000000
        }
      },
      {
        "id": "email-2",
        "type": "process-email",
        "data": {
          "from": "charlie@example.com",
          "to": "bob@example.com",
          "subject": "Great work on the presentation",
          "body": "Thanks for the excellent presentation yesterday. The team really appreciated it.",
          "timestamp": 1700000001000
        }
      }
    ]
  }'
```

### Get Results

```bash
curl http://localhost:8787/api/emails/results
```

### Get Summary

```bash
curl http://localhost:8787/api/emails/summary
```

## Deploy to Cloudflare

```bash
pnpm deploy
```

## What This Example Demonstrates

- **RouterAgent**: Routes HTTP requests to appropriate handlers
- **FleetManagerAgent**: Spawns and manages worker pool
- **WorkerAgent**: Processes individual emails (ephemeral)
- **CoordinatorAgent**: Aggregates results and provides query APIs
- **Concurrency Control**: Multiple workers process emails in parallel
- **Self-Destruction**: Workers automatically clean up after completion
- **Result Aggregation**: Coordinator maintains all results for querying

## Email Processing Features

Each email is analyzed for:
- **Word Count**: Number of words in the email body
- **Sentiment**: Positive, neutral, or negative sentiment analysis
- **Topics**: Extracted keywords (meeting, project, deadline, etc.)
- **Priority**: High, medium, or low based on urgency indicators
