/**
 * Common Agents Framework
 *
 * A reusable multi-agent framework built on top of the Cloudflare Agents SDK
 */

// Re-export Cloudflare Agents SDK
export { Agent, getAgentByName, type AgentNamespace } from 'agents';

// Base agent classes
export { BaseAgent, type BaseAgentState } from './agents/base/BaseAgent';
export {
  WorkerAgent,
  type WorkerAgentState,
  type Task,
  type TaskResult,
  type ICoordinator,
} from './agents/base/WorkerAgent';
export {
  FleetManagerAgent,
  type FleetManagerAgentState,
  type FleetManagerConfig,
  type Batch,
  type BatchStatus,
  type WorkerInfo,
} from './agents/base/FleetManagerAgent';
export {
  CoordinatorAgent,
  type CoordinatorAgentState,
  type ResultEntry,
  type Summary,
  type ResultFilter,
} from './agents/base/CoordinatorAgent';

export {
  RouterAgent,
  type RouterAgentState,
  type RoutingRule,
  type RouteResult,
  type RouteRequest,
} from './agents/base/RouterAgent';
export {
  SchedulerAgent,
  type SchedulerAgentState,
  type ScheduledTask,
} from './agents/base/SchedulerAgent';
export {
  KnowledgeBaseAgent,
  type KnowledgeBaseAgentState,
  type KnowledgeEntry,
  type SearchResult,
  type SearchOptions,
} from './agents/base/KnowledgeBaseAgent';
export {
  TaskProcessorAgent,
  type TaskProcessorAgentState,
  type TaskProgress,
  type ComplexTask,
  type ProcessingResult,
} from './agents/base/TaskProcessorAgent';
export {
  LLMToolAgent,
  type LLMToolAgentState,
  type LLMTask,
  type LLMTool,
  type LLMResponse,
  type LLMTaskResult,
} from './agents/base/LLMToolAgent';
export {
  PipelineStageAgent,
  type PipelineStageAgentState,
  type StageInput,
  type StageOutput,
  type StageMetadata,
} from './agents/base/PipelineStageAgent';
export {
  QueueAgent,
  type QueueAgentState,
  type QueueItem,
} from './agents/base/QueueAgent';
export {
  WatcherAgent,
  type WatcherAgentState,
  type Resource,
  type Condition,
  type WatchedResource,
} from './agents/base/WatcherAgent';

// Utility functions
export * from './utils/id';
export * from './utils/errors';
export * from './utils/retry';

// Types
export * from './utils/types';
