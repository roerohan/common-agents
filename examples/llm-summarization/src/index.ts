/**
 * LLM Document Summarization Example
 *
 * Demonstrates LLM-powered fan-out summarization:
 * Document → Coordinator (splits) → FleetManager → LLMAgents → Synthesis
 *
 * Flow:
 * 1. External client sends large document to Coordinator
 * 2. Coordinator splits document into chunks
 * 3. Sends chunks to FleetManager
 * 4. FleetManager spawns LLMToolAgent for each chunk
 * 5. Each LLM agent summarizes its chunk
 * 6. Agents send summaries back to Coordinator
 * 7. Agents self-destruct
 * 8. Coordinator spawns final LLMAgent to synthesize overall summary
 * 9. Returns final summary to client
 */

import {
  LLMToolAgent,
  FleetManagerAgent,
  CoordinatorAgent,
  getAgentByName,
  type Task,
  type TaskResult,
  type LLMToolAgentState,
  type AgentNamespace,
} from "common-agents";

// ============================================================================
// Types
// ============================================================================

interface Env {
  DOCUMENT_COORDINATOR: AgentNamespace<DocumentCoordinator>;
  SUMMARY_FLEET_MANAGER: AgentNamespace<SummaryFleetManager>;
  CHUNK_SUMMARIZER: AgentNamespace<ChunkSummarizer>;
  SYNTHESIS_AGENT: AgentNamespace<SynthesisAgent>;
  OPENAI_API_KEY?: string;
}

interface DocumentChunk {
  chunkIndex: number;
  totalChunks: number;
  text: string;
  metadata: {
    documentId: string;
    startPosition: number;
    endPosition: number;
  };
}

interface ChunkSummary {
  chunkIndex: number;
  summary: string;
  keyPoints: string[];
  wordCount: number;
}

interface FinalSummary {
  overallSummary: string;
  keyFindings: string[];
  chunkSummaries: ChunkSummary[];
  metadata: {
    totalChunks: number;
    totalWordCount: number;
    processingTime: number;
  };
}

// ============================================================================
// Chunk Summarizer Agent (Ephemeral LLM Agent)
// ============================================================================

export class ChunkSummarizer extends LLMToolAgent<Env, LLMToolAgentState> {
  override async executePrompt(
    _prompt: string,
    context?: unknown
  ): Promise<any> {
    // In production, this would call actual LLM API
    // For now, simulate LLM response

    const chunk = context as DocumentChunk;

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Mock LLM response
    const summary = this.generateMockSummary(chunk.text);
    const keyPoints = this.extractKeyPoints(chunk.text);

    return {
      content: JSON.stringify({
        summary,
        keyPoints,
        wordCount: chunk.text.split(/\s+/).length,
      }),
    };
  }

  async summarizeChunk(chunk: DocumentChunk): Promise<ChunkSummary> {
    const prompt = `Summarize the following text chunk (${chunk.chunkIndex + 1}/${chunk.totalChunks}):\n\n${chunk.text}`;

    const response = await this.executePrompt(prompt, chunk);
    const result = JSON.parse(response.content);

    return {
      chunkIndex: chunk.chunkIndex,
      summary: result.summary,
      keyPoints: result.keyPoints,
      wordCount: result.wordCount,
    };
  }

  private generateMockSummary(text: string): string {
    // Simple mock: take first 100 chars
    const preview = text.slice(0, 100).trim();
    return `Summary: ${preview}${text.length > 100 ? "..." : ""}`;
  }

  private extractKeyPoints(text: string): string[] {
    // Simple mock: extract sentences with numbers or important words
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const importantWords = [
      "important",
      "critical",
      "key",
      "significant",
      "major",
    ];

    return sentences
      .filter(
        (s) =>
          /\d/.test(s) ||
          importantWords.some((w) => s.toLowerCase().includes(w))
      )
      .slice(0, 3)
      .map((s) => s.trim());
  }
}

// ============================================================================
// Synthesis Agent (Ephemeral LLM Agent)
// ============================================================================

export class SynthesisAgent extends LLMToolAgent<Env, LLMToolAgentState> {
  async synthesize(chunkSummaries: ChunkSummary[]): Promise<FinalSummary> {
    // Combine all chunk summaries
    const allSummaries = chunkSummaries
      .map((c) => `Chunk ${c.chunkIndex + 1}: ${c.summary}`)
      .join("\n\n");

    const prompt = `Synthesize the following chunk summaries into a comprehensive overall summary:\n\n${allSummaries}`;

    const response = await this.executePrompt(prompt, chunkSummaries);

    // Extract key findings from all chunks
    const allKeyPoints = chunkSummaries.flatMap((c) => c.keyPoints);
    const uniqueKeyFindings = Array.from(new Set(allKeyPoints)).slice(0, 5);

    const totalWordCount = chunkSummaries.reduce(
      (sum, c) => sum + c.wordCount,
      0
    );

    return {
      overallSummary: response.content,
      keyFindings: uniqueKeyFindings,
      chunkSummaries,
      metadata: {
        totalChunks: chunkSummaries.length,
        totalWordCount,
        processingTime: 0, // Will be set by coordinator
      },
    };
  }

  override async executePrompt(_prompt: string, _context?: unknown): Promise<any> {
    // Mock synthesis
    await new Promise((resolve) => setTimeout(resolve, 300));

    return {
      content:
        "This document discusses multiple important topics across its sections, with key themes emerging around...",
    };
  }
}

// ============================================================================
// Summary Fleet Manager (Permanent)
// ============================================================================

export class SummaryFleetManager extends FleetManagerAgent<
  Env,
  any,
  DocumentChunk,
  ChunkSummary
> {
  protected async getWorkerInstance(workerId: string) {
    return (await getAgentByName(this.env.CHUNK_SUMMARIZER, workerId)) as unknown as ChunkSummarizer;
  }

  protected override async executeTaskOnWorker(
    worker: any,
    task: Task<DocumentChunk>
  ): Promise<TaskResult<ChunkSummary>> {
    const startTime = Date.now();

    try {
      const summary = await worker.summarizeChunk(task.data);

      return {
        taskId: task.id,
        success: true,
        result: summary,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }
  }
}

// ============================================================================
// Document Coordinator (Permanent)
// ============================================================================

export class DocumentCoordinator extends CoordinatorAgent<
  Env,
  any,
  ChunkSummary
> {
  // Process a document: split, summarize chunks, synthesize
  async processDocument(document: {
    id: string;
    text: string;
  }): Promise<FinalSummary> {
    const startTime = Date.now();

    // Step 1: Split document into chunks
    const chunks = this.splitIntoChunks(document.text, document.id);

    this.log(`Split document into ${chunks.length} chunks`);

    // Step 2: Create tasks for each chunk
    const tasks: Task<DocumentChunk>[] = chunks.map((chunk, index) => ({
      id: `chunk-${document.id}-${index}`,
      type: "summarize-chunk",
      data: chunk,
    }));

    // Step 3: Submit to fleet manager
    const fleetManager = (await getAgentByName(
      this.env.SUMMARY_FLEET_MANAGER,
      "default"
    )) as unknown as SummaryFleetManager;
    const batchId = await fleetManager.submitBatch(tasks);

    // Step 4: Wait for completion
    await this.waitForBatchCompletion(fleetManager, batchId);

    // Step 5: Get results
    const results = await fleetManager.getBatchResults(batchId);
    const chunkSummaries = results
      .filter((r: any) => r.success && r.result)
      .map((r: any) => r.result!)
      .sort((a: any, b: any) => a.chunkIndex - b.chunkIndex);

    // Step 6: Synthesize final summary
    const synthesisAgent = (await getAgentByName(
      this.env.SYNTHESIS_AGENT,
      `synthesis-${document.id}`
    )) as unknown as SynthesisAgent;
    const finalSummary = await synthesisAgent.synthesize(chunkSummaries);

    // Update metadata
    finalSummary.metadata.processingTime = Date.now() - startTime;

    this.log(
      `Document processed in ${finalSummary.metadata.processingTime}ms`
    );

    return finalSummary;
  }

  private splitIntoChunks(text: string, documentId: string): DocumentChunk[] {
    const chunkSize = 500; // characters per chunk
    const chunks: DocumentChunk[] = [];

    for (let i = 0; i < text.length; i += chunkSize) {
      const chunkText = text.slice(i, i + chunkSize);
      chunks.push({
        chunkIndex: chunks.length,
        totalChunks: Math.ceil(text.length / chunkSize),
        text: chunkText,
        metadata: {
          documentId,
          startPosition: i,
          endPosition: Math.min(i + chunkSize, text.length),
        },
      });
    }

    return chunks;
  }

  private async waitForBatchCompletion(
    fleetManager: any,
    batchId: string
  ): Promise<void> {
    const maxWaitTime = 60000; // 60 seconds
    const pollInterval = 500; // 500ms
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const status = await fleetManager.getBatchStatus(batchId);

      if (
        status.status === "completed" ||
        status.status === "failed" ||
        status.status === "partial"
      ) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error("Batch processing timeout");
  }
}

// ============================================================================
// HTTP Entry Point
// ============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/summarize" && request.method === "POST") {
        const body = (await request.json()) as { document: { id: string; text: string } };

        const coordinator = (await getAgentByName(
          env.DOCUMENT_COORDINATOR,
          "default"
        )) as unknown as DocumentCoordinator;

        const result = await coordinator.processDocument(body.document);

        return new Response(JSON.stringify(result, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (path === "/api/summary" && request.method === "GET") {
        const coordinator = (await getAgentByName(
          env.DOCUMENT_COORDINATOR,
          "default"
        )) as unknown as DocumentCoordinator;

        const summary = await coordinator.getSummary();

        return new Response(JSON.stringify(summary, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("Request failed:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};
