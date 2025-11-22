# PipelineStageAgent

**Type:** Permanent (Long-Lived)

## Overview

PipelineStageAgent represents a single stage in a data processing pipeline. It transforms input data and passes it to the next stage, enabling modular, composable data pipelines with clear separation of concerns.

## Responsibilities

- Process data for a specific pipeline stage
- Transform input to output format
- Track processing statistics (success/failure counts)
- Maintain stage metadata and configuration
- Pass data to next stage in pipeline
- Handle stage-specific errors

## Lifecycle

PipelineStageAgent is a permanent agent that:
1. **Initializes** with stage configuration
2. **Processes inputs** continuously
3. **Transforms data** using stage logic
4. **Maintains statistics** on processing
5. **Persists indefinitely** as part of pipeline

## Callable Methods

### `processStage(input: StageInput<TInput>): Promise<StageOutput<TOutput>>`

Process input data through this pipeline stage.

**Parameters:**
- `input` - StageInput object containing:
  - `data` - The input data to process
  - `metadata` - Optional metadata from previous stages
  - `previousStage` - Name of previous stage (if any)

**Returns:** StageOutput containing:
- `data` - The transformed output data
- `metadata` - Optional metadata to pass to next stage
- `nextStage` - Optional name of next stage

**Example:**
```typescript
const input: StageInput<RawData> = {
  data: {
    records: [...],
    format: 'csv'
  },
  metadata: {
    sourceFile: 'data.csv',
    uploadedAt: Date.now()
  },
  previousStage: 'ingestion'
};

const output = await stage.processStage(input);

console.log('Transformed data:', output.data);
console.log('Next stage:', output.nextStage);
```

### `getStageInfo(): Promise<StageMetadata>`

Get metadata about this pipeline stage.

**Returns:**
- `stageName` - Human-readable stage name
- `stageNumber` - Position in pipeline (1-indexed)
- `totalStages` - Total number of stages (if known)
- `description` - Optional stage description

**Example:**
```typescript
const info = await stage.getStageInfo();
console.log(`Stage ${info.stageNumber}: ${info.stageName}`);
if (info.description) {
  console.log(`Description: ${info.description}`);
}
```

### `getStats(): Promise<{ processed: number; failed: number }>`

Get processing statistics for this stage.

**Example:**
```typescript
const stats = await stage.getStats();
console.log(`Processed: ${stats.processed}`);
console.log(`Failed: ${stats.failed}`);
console.log(`Success rate: ${(stats.processed / (stats.processed + stats.failed) * 100).toFixed(2)}%`);
```

## Protected Methods (For Subclasses)

### `abstract transform(input: StageInput<TInput>): Promise<StageOutput<TOutput>>`

**Must be implemented by subclasses.** Contains the stage's transformation logic.

**Example Implementation:**
```typescript
class ValidationStage extends PipelineStageAgent<
  Env,
  PipelineStageAgentState,
  RawRecord[],
  ValidatedRecord[]
> {
  protected async transform(
    input: StageInput<RawRecord[]>
  ): Promise<StageOutput<ValidatedRecord[]>> {
    const validated: ValidatedRecord[] = [];
    const errors: string[] = [];

    for (const record of input.data) {
      try {
        // Validate record
        if (!record.id || !record.email) {
          throw new Error('Missing required fields');
        }

        // Validate email format
        if (!this.isValidEmail(record.email)) {
          throw new Error('Invalid email format');
        }

        validated.push({
          ...record,
          validated: true,
          validatedAt: Date.now()
        });
      } catch (error) {
        errors.push(`Record ${record.id}: ${error.message}`);
      }
    }

    return {
      data: validated,
      metadata: {
        ...input.metadata,
        totalRecords: input.data.length,
        validRecords: validated.length,
        invalidRecords: errors.length,
        errors
      },
      nextStage: 'enrichment'
    };
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
```

### `setStageMetadata(metadata: Partial<StageMetadata>): void`

Update stage metadata configuration.

**Example:**
```typescript
class MyStage extends PipelineStageAgent {
  override initialize(): void {
    super.initialize();

    this.setStageMetadata({
      stageName: 'Data Transformation',
      stageNumber: 2,
      totalStages: 5,
      description: 'Transforms raw data into structured format'
    });
  }
}
```

## Complete Example

```typescript
import { PipelineStageAgent, type StageInput, type StageOutput } from 'common-agents';
import { callable } from 'agents';

// Define data types for pipeline
interface RawOrder {
  id: string;
  customer: string;
  items: string[];
  total: number;
}

interface EnrichedOrder extends RawOrder {
  customerDetails: {
    name: string;
    email: string;
    tier: string;
  };
  itemDetails: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  enrichedAt: number;
}

// Stage 1: Validation
class OrderValidationStage extends PipelineStageAgent<
  Env,
  PipelineStageAgentState,
  RawOrder[],
  RawOrder[]
> {
  override initialize(): void {
    super.initialize();
    this.setStageMetadata({
      stageName: 'Order Validation',
      stageNumber: 1,
      totalStages: 3,
      description: 'Validates order data and filters invalid records'
    });
  }

  protected async transform(
    input: StageInput<RawOrder[]>
  ): Promise<StageOutput<RawOrder[]>> {
    const valid: RawOrder[] = [];

    for (const order of input.data) {
      if (this.isValidOrder(order)) {
        valid.push(order);
      } else {
        this.log(`Invalid order: ${order.id}`, 'warn');
      }
    }

    return {
      data: valid,
      metadata: {
        ...input.metadata,
        validatedCount: valid.length,
        invalidCount: input.data.length - valid.length
      },
      nextStage: 'enrichment'
    };
  }

  private isValidOrder(order: RawOrder): boolean {
    return !!(
      order.id &&
      order.customer &&
      order.items &&
      order.items.length > 0 &&
      order.total > 0
    );
  }
}

// Stage 2: Enrichment
class OrderEnrichmentStage extends PipelineStageAgent<
  Env,
  PipelineStageAgentState,
  RawOrder[],
  EnrichedOrder[]
> {
  override initialize(): void {
    super.initialize();
    this.setStageMetadata({
      stageName: 'Order Enrichment',
      stageNumber: 2,
      totalStages: 3,
      description: 'Enriches orders with customer and product details'
    });
  }

  protected async transform(
    input: StageInput<RawOrder[]>
  ): Promise<StageOutput<EnrichedOrder[]>> {
    const enriched: EnrichedOrder[] = [];

    for (const order of input.data) {
      // Fetch customer details
      const customerDetails = await this.getCustomerDetails(order.customer);

      // Fetch item details
      const itemDetails = await this.getItemDetails(order.items);

      enriched.push({
        ...order,
        customerDetails,
        itemDetails,
        enrichedAt: Date.now()
      });
    }

    return {
      data: enriched,
      metadata: {
        ...input.metadata,
        enrichedCount: enriched.length
      },
      nextStage: 'aggregation'
    };
  }

  private async getCustomerDetails(customerId: string) {
    // Mock customer lookup
    return {
      name: 'John Doe',
      email: 'john@example.com',
      tier: 'premium'
    };
  }

  private async getItemDetails(itemIds: string[]) {
    // Mock item lookup
    return itemIds.map(id => ({
      id,
      name: `Product ${id}`,
      price: 29.99
    }));
  }
}

// Stage 3: Aggregation
class OrderAggregationStage extends PipelineStageAgent<
  Env,
  PipelineStageAgentState,
  EnrichedOrder[],
  OrderSummary
> {
  override initialize(): void {
    super.initialize();
    this.setStageMetadata({
      stageName: 'Order Aggregation',
      stageNumber: 3,
      totalStages: 3,
      description: 'Aggregates orders into summary statistics'
    });
  }

  protected async transform(
    input: StageInput<EnrichedOrder[]>
  ): Promise<StageOutput<OrderSummary>> {
    const summary: OrderSummary = {
      totalOrders: input.data.length,
      totalRevenue: input.data.reduce((sum, o) => sum + o.total, 0),
      averageOrderValue: 0,
      customerTiers: {},
      topProducts: this.getTopProducts(input.data)
    };

    summary.averageOrderValue = summary.totalRevenue / summary.totalOrders;

    // Count customers by tier
    for (const order of input.data) {
      const tier = order.customerDetails.tier;
      summary.customerTiers[tier] = (summary.customerTiers[tier] || 0) + 1;
    }

    return {
      data: summary,
      metadata: {
        ...input.metadata,
        aggregatedAt: Date.now()
      }
    };
  }

  private getTopProducts(orders: EnrichedOrder[]): Array<{ id: string; count: number }> {
    const productCounts = new Map<string, number>();

    for (const order of orders) {
      for (const item of order.itemDetails) {
        productCounts.set(item.id, (productCounts.get(item.id) || 0) + 1);
      }
    }

    return Array.from(productCounts.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}

interface OrderSummary {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  customerTiers: Record<string, number>;
  topProducts: Array<{ id: string; count: number }>;
}
```

## Common Usage Pattern

```typescript
// 1. Create pipeline stages
const validationStage = await getAgentByName(
  env,
  'ORDER_VALIDATION_STAGE',
  'main'
);
const enrichmentStage = await getAgentByName(
  env,
  'ORDER_ENRICHMENT_STAGE',
  'main'
);
const aggregationStage = await getAgentByName(
  env,
  'ORDER_AGGREGATION_STAGE',
  'main'
);

// 2. Process data through pipeline
const rawOrders: RawOrder[] = [
  { id: '1', customer: 'cust-1', items: ['item-1', 'item-2'], total: 59.98 },
  { id: '2', customer: 'cust-2', items: ['item-3'], total: 29.99 }
];

// Stage 1: Validation
const validationOutput = await validationStage.processStage({
  data: rawOrders,
  metadata: { source: 'api' }
});

console.log(`Validated ${validationOutput.data.length} orders`);

// Stage 2: Enrichment
const enrichmentOutput = await enrichmentStage.processStage({
  data: validationOutput.data,
  metadata: validationOutput.metadata,
  previousStage: 'validation'
});

console.log(`Enriched ${enrichmentOutput.data.length} orders`);

// Stage 3: Aggregation
const aggregationOutput = await aggregationStage.processStage({
  data: enrichmentOutput.data,
  metadata: enrichmentOutput.metadata,
  previousStage: 'enrichment'
});

console.log('Summary:', aggregationOutput.data);

// 3. Check stage statistics
const stats = await validationStage.getStats();
console.log(`Validation stage: ${stats.processed} processed, ${stats.failed} failed`);
```

## Pipeline Orchestrator Example

```typescript
class PipelineOrchestrator<TEnv = unknown> {
  private stages: Map<string, any> = new Map();

  async addStage(name: string, agent: any): Promise<void> {
    this.stages.set(name, agent);
  }

  async execute<TInput, TOutput>(
    startStageName: string,
    initialData: TInput
  ): Promise<TOutput> {
    let currentStage = startStageName;
    let currentData: any = initialData;
    let metadata: Record<string, unknown> = {};

    while (currentStage) {
      const stage = this.stages.get(currentStage);
      if (!stage) {
        throw new Error(`Stage not found: ${currentStage}`);
      }

      console.log(`Executing stage: ${currentStage}`);

      const output = await stage.processStage({
        data: currentData,
        metadata,
        previousStage: currentStage
      });

      currentData = output.data;
      metadata = output.metadata || {};
      currentStage = output.nextStage;
    }

    return currentData;
  }

  async getStageStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    for (const [name, stage] of this.stages.entries()) {
      stats[name] = await stage.getStats();
    }

    return stats;
  }
}

// Usage
const pipeline = new PipelineOrchestrator();
await pipeline.addStage('validation', validationStage);
await pipeline.addStage('enrichment', enrichmentStage);
await pipeline.addStage('aggregation', aggregationStage);

const result = await pipeline.execute('validation', rawOrders);
console.log('Pipeline result:', result);

// Check all stage statistics
const stats = await pipeline.getStageStats();
console.log('Pipeline statistics:', stats);
```

## Error Handling Stage Example

```typescript
class ErrorHandlingStage<T> extends PipelineStageAgent<
  Env,
  PipelineStageAgentState,
  T,
  T
> {
  private maxRetries = 3;

  protected async transform(
    input: StageInput<T>
  ): Promise<StageOutput<T>> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.maxRetries) {
      try {
        // Try to process
        const result = await this.processWithRetry(input.data);

        return {
          data: result,
          metadata: {
            ...input.metadata,
            attempts,
            recovered: attempts > 0
          },
          nextStage: input.metadata?.nextStage as string
        };
      } catch (error) {
        lastError = error as Error;
        attempts++;
        this.log(`Attempt ${attempts} failed: ${error}`, 'warn');

        if (attempts < this.maxRetries) {
          await this.delay(1000 * attempts); // Exponential backoff
        }
      }
    }

    // All retries failed
    throw new Error(
      `Failed after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  private async processWithRetry(data: T): Promise<T> {
    // Processing logic that might fail
    return data;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Branching Pipeline Example

```typescript
class ConditionalRoutingStage extends PipelineStageAgent<
  Env,
  PipelineStageAgentState,
  any,
  any
> {
  protected async transform(
    input: StageInput<any>
  ): Promise<StageOutput<any>> {
    // Route based on data characteristics
    const dataSize = JSON.stringify(input.data).length;

    let nextStage: string;
    if (dataSize > 1000000) {
      // Large data - use batch processing
      nextStage = 'batch-processor';
    } else if (dataSize > 10000) {
      // Medium data - use standard processing
      nextStage = 'standard-processor';
    } else {
      // Small data - use fast processing
      nextStage = 'fast-processor';
    }

    return {
      data: input.data,
      metadata: {
        ...input.metadata,
        dataSize,
        routedTo: nextStage
      },
      nextStage
    };
  }
}
```

## Parallel Processing Stage Example

```typescript
class ParallelProcessingStage extends PipelineStageAgent<
  Env,
  PipelineStageAgentState,
  any[],
  any[]
> {
  private maxConcurrency = 10;

  protected async transform(
    input: StageInput<any[]>
  ): Promise<StageOutput<any[]>> {
    const results: any[] = [];
    const chunks = this.chunkArray(input.data, this.maxConcurrency);

    for (const chunk of chunks) {
      // Process chunk in parallel
      const chunkResults = await Promise.all(
        chunk.map(item => this.processItem(item))
      );
      results.push(...chunkResults);
    }

    return {
      data: results,
      metadata: {
        ...input.metadata,
        processedCount: results.length,
        chunks: chunks.length
      },
      nextStage: input.metadata?.nextStage as string
    };
  }

  private async processItem(item: any): Promise<any> {
    // Process individual item
    return item;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

## Best Practices

1. **Single responsibility** - Each stage should do one thing well
2. **Pass metadata forward** - Preserve context through the pipeline
3. **Handle errors gracefully** - Implement retry logic where appropriate
4. **Track statistics** - Monitor processing success/failure rates
5. **Use type safety** - Define clear input/output types
6. **Document stages** - Use descriptive names and descriptions
7. **Make stages composable** - Design for reusability
8. **Test independently** - Unit test each stage separately

## Performance Considerations

- Stages process data sequentially by default
- Consider parallel processing for independent operations
- Large data should be streamed, not loaded entirely
- Metadata accumulates through pipeline - keep it minimal
- Statistics are tracked in durable state
- Each stage adds latency - minimize stage count where possible
- Use batching for high-throughput pipelines
