/**
 * Scheduled Data Pipeline Example
 *
 * Demonstrates scheduled ETL pipeline with sequential stages:
 * SchedulerAgent → PipelineStages (Extract → Transform → Load) → CoordinatorAgent
 *
 * Flow:
 * 1. SchedulerAgent wakes up via alarm (e.g., daily at 3 AM)
 * 2. Triggers pipeline execution
 * 3. Pipeline executes stages sequentially:
 *    - ExtractStage: Fetches data from source
 *    - TransformStage: Cleans and transforms data
 *    - LoadStage: Saves data to destination
 * 4. Each stage agent self-destructs after completion
 * 5. Final results sent to CoordinatorAgent
 * 6. Coordinator stores completion metadata
 * 7. Scheduler sets next alarm
 */

import {
  SchedulerAgent,
  PipelineStageAgent,
  CoordinatorAgent,
  getAgentByName,
  type StageInput,
  type StageOutput,
  type PipelineStageAgentState,
  type AgentNamespace,
} from "common-agents";
import { callable } from "agents";

// ============================================================================
// Types
// ============================================================================

interface Env {
  PIPELINE_SCHEDULER: AgentNamespace<PipelineScheduler>;
  PIPELINE_COORDINATOR: AgentNamespace<PipelineCoordinator>;
  EXTRACT_STAGE: AgentNamespace<ExtractStage>;
  TRANSFORM_STAGE: AgentNamespace<TransformStage>;
  LOAD_STAGE: AgentNamespace<LoadStage>;
}

interface RawDataRecord {
  id: string;
  timestamp: number;
  value: string;
  metadata?: Record<string, unknown>;
}

interface TransformedRecord {
  id: string;
  timestamp: number;
  value: number;
  category: string;
  cleaned: boolean;
}

interface LoadResult {
  recordCount: number;
  destination: string;
  success: boolean;
  errors?: string[];
}

interface PipelineExecutionResult {
  pipelineId: string;
  startTime: number;
  endTime: number;
  stagesCompleted: string[];
  finalResult: LoadResult;
  totalDuration: number;
}

// ============================================================================
// Extract Stage (Ephemeral)
// ============================================================================

export class ExtractStage extends PipelineStageAgent<
  Env,
  PipelineStageAgentState,
  { source: string },
  RawDataRecord[]
> {
  override initialize(): void {
    super.initialize();
    this.setStageMetadata({
      stageName: "Extract",
      stageNumber: 1,
      totalStages: 3,
      description: "Extract data from source",
    });
  }

  protected override async transform(
    input: StageInput<{ source: string }>
  ): Promise<StageOutput<RawDataRecord[]>> {
    this.log(`Extracting data from ${input.data.source}`);

    // Simulate data extraction
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Mock extracted data
    const records: RawDataRecord[] = [
      {
        id: "rec-1",
        timestamp: Date.now(),
        value: "100.5",
        metadata: { type: "sensor-a" },
      },
      {
        id: "rec-2",
        timestamp: Date.now(),
        value: "invalid",
        metadata: { type: "sensor-b" },
      },
      {
        id: "rec-3",
        timestamp: Date.now(),
        value: "250.75",
        metadata: { type: "sensor-a" },
      },
      {
        id: "rec-4",
        timestamp: Date.now(),
        value: "99.0",
        metadata: { type: "sensor-c" },
      },
    ];

    this.log(`Extracted ${records.length} records`);

    return {
      data: records,
      metadata: {
        extractedAt: Date.now(),
        source: input.data.source,
        recordCount: records.length,
      },
      nextStage: "transform",
    };
  }
}

// ============================================================================
// Transform Stage (Ephemeral)
// ============================================================================

export class TransformStage extends PipelineStageAgent<
  Env,
  PipelineStageAgentState,
  RawDataRecord[],
  TransformedRecord[]
> {
  override initialize(): void {
    super.initialize();
    this.setStageMetadata({
      stageName: "Transform",
      stageNumber: 2,
      totalStages: 3,
      description: "Clean and transform data",
    });
  }

  protected override async transform(
    input: StageInput<RawDataRecord[]>
  ): Promise<StageOutput<TransformedRecord[]>> {
    this.log(`Transforming ${input.data.length} records`);

    // Simulate transformation processing
    await new Promise((resolve) => setTimeout(resolve, 300));

    const transformed: TransformedRecord[] = [];

    for (const record of input.data) {
      try {
        const numericValue = parseFloat(record.value);

        if (isNaN(numericValue)) {
          // Skip invalid records
          this.log(`Skipping invalid record: ${record.id}`);
          continue;
        }

        // Determine category based on value
        const category =
          numericValue < 100 ? "low" : numericValue < 200 ? "medium" : "high";

        transformed.push({
          id: record.id,
          timestamp: record.timestamp,
          value: numericValue,
          category,
          cleaned: true,
        });
      } catch (error) {
        this.log(
          `Error transforming record ${record.id}: ${error}`,
          "error"
        );
      }
    }

    this.log(`Transformed ${transformed.length} valid records`);

    return {
      data: transformed,
      metadata: {
        transformedAt: Date.now(),
        validRecords: transformed.length,
        skippedRecords: input.data.length - transformed.length,
      },
      nextStage: "load",
    };
  }
}

// ============================================================================
// Load Stage (Ephemeral)
// ============================================================================

export class LoadStage extends PipelineStageAgent<
  Env,
  PipelineStageAgentState,
  TransformedRecord[],
  LoadResult
> {
  override initialize(): void {
    super.initialize();
    this.setStageMetadata({
      stageName: "Load",
      stageNumber: 3,
      totalStages: 3,
      description: "Load data to destination",
    });
  }

  protected override async transform(
    input: StageInput<TransformedRecord[]>
  ): Promise<StageOutput<LoadResult>> {
    this.log(`Loading ${input.data.length} records to destination`);

    // Simulate data loading
    await new Promise((resolve) => setTimeout(resolve, 250));

    const destination = "database://production/metrics";
    const errors: string[] = [];

    // Mock: Simulate some records failing to load
    const successfulRecords = input.data.filter((record) => {
      if (record.value > 500) {
        // Simulate validation error
        errors.push(`Record ${record.id}: value exceeds maximum`);
        return false;
      }
      return true;
    });

    const result: LoadResult = {
      recordCount: successfulRecords.length,
      destination,
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };

    this.log(
      `Loaded ${result.recordCount} records (${errors.length} errors)`
    );

    return {
      data: result,
      metadata: {
        loadedAt: Date.now(),
        destination,
        successCount: successfulRecords.length,
        errorCount: errors.length,
      },
    };
  }
}

// ============================================================================
// Pipeline Coordinator (Permanent)
// ============================================================================

export class PipelineCoordinator extends CoordinatorAgent<
  Env,
  any,
  PipelineExecutionResult
> {
  @callable()
  async executePipeline(pipelineId: string): Promise<PipelineExecutionResult> {
    const startTime = Date.now();
    this.log(`Starting pipeline execution: ${pipelineId}`);

    const stagesCompleted: string[] = [];

    try {
      // Stage 1: Extract
      const extractStage = (await getAgentByName(
        this.env.EXTRACT_STAGE,
        `extract-${pipelineId}`
      )) as unknown as ExtractStage;

      const extractOutput: StageOutput<RawDataRecord[]> = await extractStage.processStage({
        data: { source: "api://data-source/metrics" },
        metadata: { pipelineId },
      });

      stagesCompleted.push("extract");
      this.log(`Extract stage completed: ${extractOutput.data.length} records`);

      // Stage 2: Transform
      const transformStage = (await getAgentByName(
        this.env.TRANSFORM_STAGE,
        `transform-${pipelineId}`
      )) as unknown as TransformStage;

      const transformOutput: StageOutput<TransformedRecord[]> = await transformStage.processStage({
        data: extractOutput.data,
        metadata: { pipelineId, ...extractOutput.metadata },
        previousStage: "extract",
      });

      stagesCompleted.push("transform");
      this.log(
        `Transform stage completed: ${transformOutput.data.length} records`
      );

      // Stage 3: Load
      const loadStage = (await getAgentByName(
        this.env.LOAD_STAGE,
        `load-${pipelineId}`
      )) as unknown as LoadStage;

      const loadOutput: StageOutput<LoadResult> = await loadStage.processStage({
        data: transformOutput.data,
        metadata: { pipelineId, ...transformOutput.metadata },
        previousStage: "transform",
      });

      stagesCompleted.push("load");
      this.log(`Load stage completed: ${loadOutput.data.recordCount} records loaded`);

      const endTime = Date.now();

      const result: PipelineExecutionResult = {
        pipelineId,
        startTime,
        endTime,
        stagesCompleted,
        finalResult: loadOutput.data,
        totalDuration: endTime - startTime,
      };

      // Store result
      await this.submitResult(pipelineId, {
        taskId: pipelineId,
        success: true,
        result,
        duration: result.totalDuration,
        timestamp: endTime,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.log(`Pipeline failed: ${errorMessage}`);

      const endTime = Date.now();

      const result: PipelineExecutionResult = {
        pipelineId,
        startTime,
        endTime,
        stagesCompleted,
        finalResult: {
          recordCount: 0,
          destination: "",
          success: false,
          errors: [errorMessage],
        },
        totalDuration: endTime - startTime,
      };

      return result;
    }
  }

  @callable()
  async getLastExecution(): Promise<PipelineExecutionResult | null> {
    const results = await this.getSuccessfulResults(1);
    return results.length > 0 && results[0] ? results[0] : null;
  }
}

// ============================================================================
// Pipeline Scheduler (Permanent)
// ============================================================================

export class PipelineScheduler extends SchedulerAgent<Env, any> {
  override async initialize(): Promise<void> {
    super.initialize();

    // Schedule daily pipeline at 3 AM (if not already scheduled)
    const tasks = await this.getScheduledTasks();
    const hasDailyPipeline = tasks.some((t) => t.name === "daily-etl-pipeline");

    if (!hasDailyPipeline) {
      // Schedule for 3 AM tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(3, 0, 0, 0);

      await this.scheduleRecurringTask(
        "daily-etl-pipeline",
        "executeDailyPipeline",
        24 * 60 * 60 * 1000, // 24 hours
        { executionTime: "03:00" }
      );

      this.log("Scheduled daily ETL pipeline for 3 AM");
    }
  }

  // This method is called by the scheduler
  async executeDailyPipeline(_payload: unknown): Promise<void> {
    this.log("Executing scheduled daily pipeline");

    const coordinator = (await getAgentByName(
      this.env.PIPELINE_COORDINATOR,
      "default"
    )) as unknown as PipelineCoordinator;

    const pipelineId = `daily-${Date.now()}`;
    const result = await coordinator.executePipeline(pipelineId);

    this.log(
      `Pipeline ${pipelineId} completed in ${result.totalDuration}ms: ${result.finalResult.recordCount} records loaded`
    );
  }

  @callable()
  async triggerPipelineNow(): Promise<string> {
    const coordinator = (await getAgentByName(
      this.env.PIPELINE_COORDINATOR,
      "default"
    )) as unknown as PipelineCoordinator;

    const pipelineId = `manual-${Date.now()}`;
    await coordinator.executePipeline(pipelineId);

    return pipelineId;
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
      // Trigger pipeline manually
      if (path === "/api/pipeline/trigger" && request.method === "POST") {
        const scheduler = (await getAgentByName(
          env.PIPELINE_SCHEDULER,
          "default"
        )) as unknown as PipelineScheduler;

        const pipelineId = await scheduler.triggerPipelineNow();

        return new Response(
          JSON.stringify({
            message: "Pipeline triggered",
            pipelineId,
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Get last execution
      if (path === "/api/pipeline/last" && request.method === "GET") {
        const coordinator = (await getAgentByName(
          env.PIPELINE_COORDINATOR,
          "default"
        )) as unknown as PipelineCoordinator;

        const lastExecution = await coordinator.getLastExecution();

        return new Response(JSON.stringify(lastExecution, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get all executions
      if (path === "/api/pipeline/history" && request.method === "GET") {
        const coordinator = (await getAgentByName(
          env.PIPELINE_COORDINATOR,
          "default"
        )) as unknown as PipelineCoordinator;

        const summary = await coordinator.getSummary();

        return new Response(JSON.stringify(summary, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get scheduled tasks
      if (path === "/api/pipeline/schedule" && request.method === "GET") {
        const scheduler = (await getAgentByName(
          env.PIPELINE_SCHEDULER,
          "default"
        )) as unknown as PipelineScheduler;

        const tasks = await scheduler.getScheduledTasks();

        return new Response(JSON.stringify(tasks, null, 2), {
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
