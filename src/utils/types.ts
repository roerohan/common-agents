/**
 * Common type definitions for the multi-agent framework
 */

// ============================================================================
// Base Types
// ============================================================================

export interface Task {
  id: string;
  type: string;
  priority?: number;
  createdAt: number;
  data: Record<string, unknown>;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  completedAt?: number;
}

export interface ComplexTask extends Task {
  steps: TaskStep[];
  pausable: boolean;
  timeoutMs?: number;
}

export interface TaskStep {
  id: string;
  name: string;
  completed: boolean;
  result?: unknown;
}

export interface TaskProgress {
  taskId: string;
  currentStep: number;
  totalSteps: number;
  percentComplete: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
}

// ============================================================================
// Agent State Types
// ============================================================================

export interface BaseState {
  created: number;
  lastUpdated: number;
  version: string;
}

export interface CoordinatorState<T = unknown> extends BaseState {
  results: Array<ResultEntry<T>>;
  metadata: Record<string, unknown>;
  workerCount: number;
  completedCount: number;
}

export interface ResultEntry<T = unknown> {
  workerId: string;
  result: T;
  timestamp: number;
}

export interface ResultFilter {
  workerId?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
}

export interface Summary {
  totalResults: number;
  successCount: number;
  failureCount: number;
  averageDuration?: number;
  metadata: Record<string, unknown>;
}

export interface KnowledgeBaseState extends BaseState {
  entries: Record<string, KnowledgeEntry>;
  indexes: Record<string, string[]>;
}

export interface KnowledgeEntry {
  key: string;
  data: unknown;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface SearchResult {
  key: string;
  data: unknown;
  score: number;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Routing Types
// ============================================================================

export interface RoutingRule {
  id: string;
  priority: number;
  condition: RoutingCondition;
  target: RoutingTarget;
  enabled: boolean;
}

export interface RoutingCondition {
  type: 'path' | 'header' | 'body' | 'custom';
  field?: string;
  operator: 'equals' | 'contains' | 'matches' | 'gt' | 'lt';
  value: string | number | boolean;
}

export interface RoutingTarget {
  agentType: string;
  agentId?: string;
  method: string;
}

export interface RouteResult {
  matched: boolean;
  rule?: RoutingRule;
  target?: RoutingTarget;
  error?: string;
}

export interface RouterState extends BaseState {
  rules: Record<string, RoutingRule>;
  routingStats: Record<string, number>;
}

// ============================================================================
// Scheduling Types
// ============================================================================

export interface ScheduledTask {
  id: string;
  name: string;
  executeAt: number;
  recurring?: RecurringSchedule;
  targetAgent: {
    type: string;
    id: string;
    method: string;
    args: unknown[];
  };
  enabled: boolean;
  lastExecuted?: number;
  nextExecution?: number;
}

export interface RecurringSchedule {
  type: 'interval' | 'cron';
  value: string | number; // Cron expression or interval in ms
}

export interface SchedulerState extends BaseState {
  tasks: Record<string, ScheduledTask>;
  executionHistory: ExecutionRecord[];
}

export interface ExecutionRecord {
  taskId: string;
  executedAt: number;
  success: boolean;
  error?: string;
  duration: number;
}

// ============================================================================
// Fleet Management Types
// ============================================================================

export interface BatchJob {
  id: string;
  tasks: Task[];
  workerType: string;
  coordinatorId: string;
  createdAt: number;
  status: BatchStatus;
  options: BatchOptions;
}

export interface BatchStatus {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  inProgress: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: number;
  completedAt?: number;
}

export interface BatchOptions {
  maxConcurrency?: number;
  retryAttempts?: number;
  timeoutMs?: number;
  shardBy?: string;
}

export interface WorkerAllocation {
  workerId: string;
  taskId: string;
  assignedAt: number;
  status: 'assigned' | 'running' | 'completed' | 'failed';
}

export interface FleetManagerState extends BaseState {
  batches: Record<string, BatchJob>;
  activeWorkers: Record<string, WorkerAllocation>;
  workerPool: WorkerPoolConfig;
}

export interface WorkerPoolConfig {
  minWorkers: number;
  maxWorkers: number;
  currentWorkers: number;
  workerType: string;
}

// ============================================================================
// Queue Types
// ============================================================================

export interface QueueEntry<T = unknown> {
  id: string;
  data: T;
  priority: number;
  enqueuedAt: number;
  attempts: number;
  maxAttempts: number;
}

export interface QueueState extends BaseState {
  entries: Record<string, QueueEntry>;
  deadLetterQueue: Record<string, QueueEntry>;
  stats: QueueStats;
}

export interface QueueStats {
  totalEnqueued: number;
  totalDequeued: number;
  totalFailed: number;
  currentLength: number;
}

// ============================================================================
// Watcher Types
// ============================================================================

export interface WatchedResource {
  id: string;
  resource: Resource;
  condition: WatchCondition;
  action: WatchAction;
  lastChecked?: number;
  lastTriggered?: number;
  enabled: boolean;
}

export interface Resource {
  type: 'url' | 'agent' | 'state' | 'custom';
  identifier: string;
  pollIntervalMs: number;
}

export interface WatchCondition {
  type: 'change' | 'threshold' | 'custom';
  field?: string;
  operator?: 'equals' | 'gt' | 'lt' | 'contains';
  value?: unknown;
}

export interface WatchAction {
  type: 'notify' | 'invoke' | 'custom';
  target: {
    agentType: string;
    agentId: string;
    method: string;
    args?: unknown[];
  };
}

export interface WatcherState extends BaseState {
  watches: Record<string, WatchedResource>;
  triggerHistory: TriggerRecord[];
}

export interface TriggerRecord {
  watchId: string;
  triggeredAt: number;
  reason: string;
  success: boolean;
}

// ============================================================================
// LLM Types
// ============================================================================

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolProperty>;
  required?: string[];
}

export interface ToolProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: ToolProperty;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'length' | 'tool_calls';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface Context {
  systemPrompt?: string;
  userContext?: Record<string, unknown>;
  conversationHistory?: LLMMessage[];
}

// ============================================================================
// Pipeline Types
// ============================================================================

export interface StageInput<T = unknown> {
  data: T;
  metadata: StageMetadata;
  previousStageOutput?: unknown;
}

export interface StageOutput<T = unknown> {
  data: T;
  metadata: StageMetadata;
  error?: string;
}

export interface StageMetadata {
  stageId: string;
  stageName: string;
  pipelineId: string;
  executionId: string;
  startedAt: number;
  completedAt?: number;
  nextStage?: string;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStageConfig[];
  createdAt: number;
}

export interface PipelineStageConfig {
  id: string;
  name: string;
  agentType: string;
  order: number;
  config: Record<string, unknown>;
}

// ============================================================================
// Agent Communication Types
// ============================================================================

export interface AgentMessage<T = unknown> {
  from: AgentIdentifier;
  to: AgentIdentifier;
  type: string;
  payload: T;
  timestamp: number;
  correlationId?: string;
}

export interface AgentIdentifier {
  type: string;
  id: string;
}

export interface AgentInvocation<TArgs = unknown[], TResult = unknown> {
  method: string;
  args: TArgs;
  result?: TResult;
  error?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export interface AgentError {
  code: string;
  message: string;
  agentType: string;
  agentId: string;
  timestamp: number;
  stack?: string;
  context?: Record<string, unknown>;
}

// ============================================================================
// Lifecycle Types
// ============================================================================

export interface LifecycleHooks {
  onInitialize?: () => Promise<void>;
  onBeforeTask?: () => Promise<void>;
  onAfterTask?: () => Promise<void>;
  onCleanup?: () => Promise<void>;
  onError?: (error: Error) => Promise<void>;
}

export interface AgentMetrics {
  invocations: number;
  successCount: number;
  errorCount: number;
  averageDuration: number;
  lastInvocation?: number;
}
