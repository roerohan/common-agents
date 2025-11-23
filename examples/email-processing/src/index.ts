/**
 * Email Processing Example
 *
 * Demonstrates a complete email processing pipeline:
 * RouterAgent → FleetManagerAgent → WorkerAgent → CoordinatorAgent
 *
 * Flow:
 * 1. HTTP request with email batch → RouterAgent
 * 2. Router routes to FleetManagerAgent
 * 3. FleetManager spawns EmailWorker for each email
 * 4. Workers process emails and extract summaries
 * 5. Workers report results to CoordinatorAgent
 * 6. Workers self-destruct
 * 7. Client queries Coordinator for aggregated results
 */

import {
  RouterAgent,
  FleetManagerAgent,
  WorkerAgent,
  CoordinatorAgent,
  getAgentByName,
  type Task,
  type TaskResult,
  type RouteRequest,
  type WorkerAgentState,
  type AgentNamespace,
  type FleetManagerAgentState,
  type CoordinatorAgentState,
  type RouterAgentState,
} from "common-agents";
import { callable } from "agents";

// ============================================================================
// Types
// ============================================================================

interface Env {
  EMAIL_ROUTER: AgentNamespace<EmailRouterAgent>;
  EMAIL_FLEET_MANAGER: AgentNamespace<EmailFleetManager>;
  EMAIL_WORKER: AgentNamespace<EmailWorker>;
  EMAIL_COORDINATOR: AgentNamespace<EmailCoordinator>;
}

interface EmailData {
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: number;
}

interface EmailSummary {
  from: string;
  subject: string;
  wordCount: number;
  sentiment: "positive" | "neutral" | "negative";
  topics: string[];
  priority: "high" | "medium" | "low";
}

// API request body type
interface EmailBatchRequest {
  emails: Array<Task<EmailData>>;
}

// ============================================================================
// Email Worker Agent (Ephemeral)
// ============================================================================

export class EmailWorker extends WorkerAgent<
  Env,
  WorkerAgentState,
  EmailData,
  EmailSummary
> {
  protected async processTask(task: Task<EmailData>): Promise<EmailSummary> {
    const email = task.data;

    // Validate email data
    if (!email.from || !email.to || !email.subject || !email.body) {
      throw new Error("Invalid email data: missing required fields");
    }

    // Simulate email processing
    const wordCount = email.body.split(/\s+/).length;
    const sentiment = this.analyzeSentiment(email.body);
    const topics = this.extractTopics(email.body);
    const priority = this.determinePriority(email);

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      from: email.from,
      subject: email.subject,
      wordCount,
      sentiment,
      topics,
      priority,
    };
  }

  protected async reportResult(
    result: TaskResult<EmailSummary>
  ): Promise<void> {
    // Report to coordinator
    const coordinator = (await getAgentByName(
      this.env.EMAIL_COORDINATOR,
      "default"
    ));
    await coordinator.submitResult(this.getWorkerId(), result);

    this.log(
      `Reported result for task ${result.taskId} to coordinator`,
      "info"
    );
  }

  private analyzeSentiment(
    text: string
  ): "positive" | "neutral" | "negative" {
    const positiveWords = [
      "great",
      "excellent",
      "thanks",
      "appreciate",
      "good",
    ];
    const negativeWords = ["issue", "problem", "urgent", "critical", "error"];

    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter((w) =>
      lowerText.includes(w)
    ).length;
    const negativeCount = negativeWords.filter((w) =>
      lowerText.includes(w)
    ).length;

    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "negative";
    return "neutral";
  }

  private extractTopics(text: string): string[] {
    const topics = new Set<string>();
    const keywords = [
      "meeting",
      "project",
      "deadline",
      "budget",
      "report",
      "update",
    ];

    const lowerText = text.toLowerCase();
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        topics.add(keyword);
      }
    }

    return Array.from(topics);
  }

  private determinePriority(email: EmailData): "high" | "medium" | "low" {
    const urgentWords = ["urgent", "asap", "critical", "emergency"];
    const lowerSubject = email.subject.toLowerCase();
    const lowerBody = email.body.toLowerCase();

    if (
      urgentWords.some(
        (w) => lowerSubject.includes(w) || lowerBody.includes(w)
      )
    ) {
      return "high";
    }

    if (email.body.length > 500) {
      return "medium";
    }

    return "low";
  }
}

// ============================================================================
// Email Fleet Manager (Permanent)
// ============================================================================

export class EmailFleetManager extends FleetManagerAgent<
  Env,
  FleetManagerAgentState,
  EmailData,
  EmailSummary
> {
  protected async getWorkerInstance(workerId: string) {
    return await getAgentByName(this.env.EMAIL_WORKER, workerId);
  }
}

// ============================================================================
// Email Coordinator (Permanent)
// ============================================================================

export class EmailCoordinator extends CoordinatorAgent<
  Env,
  CoordinatorAgentState,
  EmailSummary
> {
  // Add custom method to get emails by priority
  @callable()
  async getEmailsByPriority(
    priority: "high" | "medium" | "low"
  ): Promise<EmailSummary[]> {
    const results = await this.getSuccessfulResults();
    return results.filter((r) => r.priority === priority);
  }

  // Add custom method to get sentiment breakdown
  @callable()
  async getSentimentBreakdown(): Promise<Record<string, number>> {
    const results = await this.getSuccessfulResults();
    const breakdown = { positive: 0, neutral: 0, negative: 0 };

    for (const result of results) {
      breakdown[result.sentiment]++;
    }

    return breakdown;
  }
}

// ============================================================================
// Email Router (Permanent)
// ============================================================================

export class EmailRouterAgent extends RouterAgent<Env, RouterAgentState> {
  @callable()
  async handleRoute(request: RouteRequest): Promise<unknown> {
    const routeResult = await this.route(request);
    if (!routeResult.matched || !routeResult.rule) {
      throw new Error("No matching route found");
    }
    return await this.executeRoute(request, routeResult.rule);
  }

  override async initialize(): Promise<void> {
    super.initialize();

    // Set up routing rules
    if (Object.keys(this.state.rules).length === 0) {
      await this.addRule({
        id: "process-emails",
        name: "Process Email Batch",
        pattern: "/api/emails/process",
        targetAgent: "EMAIL_FLEET_MANAGER",
        targetMethod: "submitBatch",
        priority: 100,
        enabled: true,
      });

      await this.addRule({
        id: "get-results",
        name: "Get Email Results",
        pattern: "/api/emails/results",
        targetAgent: "EMAIL_COORDINATOR",
        targetMethod: "getResults",
        priority: 100,
        enabled: true,
      });

      await this.addRule({
        id: "get-summary",
        name: "Get Email Summary",
        pattern: "/api/emails/summary",
        targetAgent: "EMAIL_COORDINATOR",
        targetMethod: "getSummary",
        priority: 100,
        enabled: true,
      });
    }
  }

  // Override to handle actual routing
  protected override async executeRoute(
    request: RouteRequest,
    rule: any
  ): Promise<unknown> {
    this.log(`Routing ${request.path} to ${rule.targetAgent}`);

    const agentNamespace = this.env[rule.targetAgent as keyof Env] as any;
    const agent = (await getAgentByName(agentNamespace, "default")) as any;

    // Transform request body based on target method
    let methodArg = request.body;

    // Fix: Extract emails array from request body for submitBatch
    if (rule.targetMethod === "submitBatch" && request.body) {
      const batchRequest = request.body as EmailBatchRequest;
      if (batchRequest.emails && Array.isArray(batchRequest.emails)) {
        methodArg = batchRequest.emails;
      } else {
        throw new Error("Invalid request body: expected {emails: Array<Task<EmailData>>}");
      }
    }

    // Call the target method
    if (rule.targetMethod && typeof agent[rule.targetMethod] === "function") {
      return await agent[rule.targetMethod](methodArg);
    }

    return { routed: true, targetAgent: rule.targetAgent };
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
      // Get router instance
      const router = (await getAgentByName(env.EMAIL_ROUTER, "default")) as unknown as EmailRouterAgent;

      // Route the request
      const routeRequest: RouteRequest = {
        path,
        method: request.method,
        headers: Object.fromEntries(request.headers),
        body: request.method !== "GET" ? await request.json() : undefined,
      };

      // Handle the route
      const result = await router.handleRoute(routeRequest);

      return new Response(JSON.stringify(result, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
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
