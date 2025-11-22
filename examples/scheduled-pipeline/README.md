# Scheduled Data Pipeline Example

This example demonstrates a scheduled ETL (Extract-Transform-Load) pipeline that runs on a schedule using alarms.

## Architecture

```
SchedulerAgent (alarm) → PipelineCoordinator → Pipeline Stages (sequential)
                                                  ├─ ExtractStage
                                                  ├─ TransformStage
                                                  └─ LoadStage
                                                       ↓
                         CoordinatorAgent ← (stores results)
```

## Flow

1. **SchedulerAgent** wakes up via alarm (e.g., daily at 3 AM)
2. Triggers **PipelineCoordinator** to execute pipeline
3. **Coordinator** executes stages sequentially:
   - **ExtractStage**: Fetches data from source (4 records)
   - **TransformStage**: Cleans and transforms data (validates, categorizes)
   - **LoadStage**: Saves data to destination
4. Each stage agent self-destructs after completion
5. Final results sent to CoordinatorAgent for storage
6. Scheduler automatically sets next alarm for tomorrow

## Running Locally

```bash
# Install dependencies (from repo root)
pnpm install

# Start development server
cd examples/scheduled-pipeline
pnpm dev
```

## API Endpoints

### Trigger Pipeline Manually

```bash
curl -X POST http://localhost:8787/api/pipeline/trigger
```

Response:
```json
{
  "message": "Pipeline triggered",
  "pipelineId": "manual-1700000000000"
}
```

### Get Last Execution

```bash
curl http://localhost:8787/api/pipeline/last
```

Response:
```json
{
  "pipelineId": "manual-1700000000000",
  "startTime": 1700000000000,
  "endTime": 1700000000750,
  "stagesCompleted": ["extract", "transform", "load"],
  "finalResult": {
    "recordCount": 3,
    "destination": "database://production/metrics",
    "success": true
  },
  "totalDuration": 750
}
```

### Get Execution History

```bash
curl http://localhost:8787/api/pipeline/history
```

### Get Scheduled Tasks

```bash
curl http://localhost:8787/api/pipeline/schedule
```

Response:
```json
[
  {
    "id": "schedule-123",
    "name": "daily-etl-pipeline",
    "scheduleType": "recurring",
    "interval": 86400000,
    "enabled": true,
    "nextExecuteAt": 1700100000000,
    "executionCount": 5
  }
]
```

## Deploy to Cloudflare

```bash
pnpm deploy
```

## What This Example Demonstrates

- **SchedulerAgent**: Automatically triggers pipelines on schedule
- **Alarm System**: Uses Cloudflare alarms for reliable scheduling
- **Sequential Processing**: Stages execute in order (Extract → Transform → Load)
- **PipelineStageAgent**: Each stage is a separate ephemeral agent
- **Data Transformation**: Extract raw data, clean/validate, load to destination
- **Error Handling**: Stages handle invalid data gracefully
- **Self-Destruction**: All ephemeral stage agents clean up automatically
- **Result Storage**: Coordinator maintains execution history
- **Recurring Tasks**: Automatic daily execution at 3 AM

## Pipeline Stages

### 1. Extract Stage

- Fetches data from mock API source
- Extracts 4 sample records with metadata
- Passes raw data to next stage
- **Duration**: ~200ms

### 2. Transform Stage

- Validates numeric values
- Categorizes records (low/medium/high)
- Filters out invalid records
- Cleans and normalizes data
- **Duration**: ~300ms

### 3. Load Stage

- Validates transformed records
- Simulates database insertion
- Handles load errors
- Returns success/failure status
- **Duration**: ~250ms

## Scheduling

The scheduler automatically sets up:

- **Daily execution at 3 AM**
- **Recurring interval**: 24 hours
- **Automatic rescheduling**: After each execution
- **Manual triggering**: Via API endpoint

To customize the schedule, modify the `PipelineScheduler.initialize()` method:

```typescript
// Run every 6 hours
await this.scheduleRecurringTask(
  "pipeline",
  "executeDailyPipeline",
  6 * 60 * 60 * 1000, // 6 hours
  { executionTime: "custom" }
);
```

## Data Flow Example

```
Extract:
  Raw: [
    { id: "rec-1", value: "100.5", metadata: { type: "sensor-a" } },
    { id: "rec-2", value: "invalid", metadata: { type: "sensor-b" } },
    { id: "rec-3", value: "250.75", metadata: { type: "sensor-a" } },
    { id: "rec-4", value: "99.0", metadata: { type: "sensor-c" } }
  ]

Transform:
  Cleaned: [
    { id: "rec-1", value: 100.5, category: "medium", cleaned: true },
    { id: "rec-3", value: 250.75, category: "high", cleaned: true },
    { id: "rec-4", value: 99.0, category: "low", cleaned: true }
  ]
  Skipped: ["rec-2"] (invalid value)

Load:
  Loaded: 3 records
  Destination: database://production/metrics
  Success: true
```

## Monitoring

Track pipeline executions:

```bash
# Get execution summary
curl http://localhost:8787/api/pipeline/history

# Check last run
curl http://localhost:8787/api/pipeline/last

# Verify scheduled tasks
curl http://localhost:8787/api/pipeline/schedule
```

## Production Considerations

1. **Data Sources**: Replace mock data with actual API calls
2. **Error Handling**: Add retry logic for transient failures
3. **Alerting**: Send notifications on pipeline failures
4. **Monitoring**: Track execution times and success rates
5. **Scaling**: Adjust stage processing for large datasets
6. **Backup**: Implement fallback data sources
7. **Validation**: Add comprehensive data validation rules
