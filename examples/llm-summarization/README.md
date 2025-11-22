# LLM Document Summarization Example

This example demonstrates an LLM-powered document summarization pipeline using fan-out/fan-in pattern.

## Architecture

```
External Request → DocumentCoordinator → FleetManager → ChunkSummarizer (N instances)
                          ↑                                      ↓
                          └────────── (collect summaries) ───────┘
                          ↓
                   SynthesisAgent (final summary)
```

## Flow

1. Client sends large document to DocumentCoordinator
2. Coordinator splits document into chunks (500 chars each)
3. Coordinator sends chunks to SummaryFleetManager
4. FleetManager spawns ChunkSummarizer (LLM agent) for each chunk
5. Each LLM agent summarizes its chunk in parallel
6. Agents send summaries back to Coordinator
7. Agents self-destruct
8. Coordinator spawns SynthesisAgent to create final summary
9. Returns comprehensive summary to client

## Running Locally

```bash
# Install dependencies (from repo root)
pnpm install

# Start development server
cd examples/llm-summarization
pnpm dev
```

## API Endpoints

### Summarize Document

```bash
curl -X POST http://localhost:8787/api/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "document": {
      "id": "doc-123",
      "text": "This is a very long document that needs to be summarized. It contains multiple paragraphs and sections discussing various topics. The content is extensive and requires breaking down into smaller chunks for efficient processing. Each chunk will be analyzed independently by separate LLM agents, allowing for parallel processing and faster results. The key topics include: project management, team collaboration, resource allocation, and deadline management. Furthermore, the document explores best practices for distributed systems, scalability considerations, and performance optimization techniques. Additional sections cover monitoring strategies, error handling approaches, and deployment procedures for modern cloud infrastructure."
    }
  }'
```

Response:
```json
{
  "overallSummary": "This document discusses multiple important topics...",
  "keyFindings": [
    "Project management and team collaboration are priorities",
    "Distributed systems require careful scalability planning",
    "Modern cloud infrastructure needs robust monitoring"
  ],
  "chunkSummaries": [
    {
      "chunkIndex": 0,
      "summary": "Summary: This is a very long document...",
      "keyPoints": [...],
      "wordCount": 45
    }
  ],
  "metadata": {
    "totalChunks": 3,
    "totalWordCount": 135,
    "processingTime": 1250
  }
}
```

### Get Processing Summary

```bash
curl http://localhost:8787/api/summary
```

## Deploy to Cloudflare

### Configure API Key

For production use with real LLM APIs, add your API key to `wrangler.toml`:

```toml
[vars]
OPENAI_API_KEY = "your-api-key-here"
```

### Deploy

```bash
pnpm deploy
```

## What This Example Demonstrates

- **Document Chunking**: Automatically splits large documents
- **Parallel Processing**: Multiple LLM agents process chunks simultaneously
- **Fan-Out Pattern**: FleetManager spawns workers for each chunk
- **Fan-In Pattern**: Coordinator collects all chunk summaries
- **LLM Integration**: Shows how to integrate LLM APIs (mocked in this example)
- **Synthesis**: Final agent combines chunk summaries into overall summary
- **Self-Destruction**: All ephemeral agents clean up automatically
- **Progress Tracking**: Monitor processing via coordinator

## Integrating Real LLM APIs

To use actual LLM APIs (OpenAI, Anthropic, etc.), modify the `ChunkSummarizer` and `SynthesisAgent`:

```typescript
export class ChunkSummarizer extends LLMToolAgent<Env, LLMToolAgentState> {
  override async executePrompt(prompt: string, context?: unknown): Promise<any> {
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful summarization assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500
      })
    });

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: data.usage
    };
  }
}
```

## Performance

- Chunk size: 500 characters (configurable)
- Parallel processing: Up to `maxConcurrentWorkers` chunks at once
- Mock LLM delay: 200ms per chunk
- Synthesis delay: 300ms
- Total time depends on document size and LLM API latency

## Scalability

The fan-out pattern allows:
- Processing documents of any size
- Horizontal scaling with more workers
- Independent chunk processing
- Fault tolerance (failed chunks can be retried)
