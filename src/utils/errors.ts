/**
 * Custom error classes for the agent framework
 */

import type { AgentError } from './types';

/**
 * Base error class for all agent-related errors
 */
export class AgentFrameworkError extends Error {
  public readonly code: string;
  public readonly agentType: string;
  public readonly agentId: string;
  public readonly timestamp: number;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    agentType: string,
    agentId: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentFrameworkError';
    this.code = code;
    this.agentType = agentType;
    this.agentId = agentId;
    this.timestamp = Date.now();
    this.context = context;

    // Maintains proper stack trace for where our error was thrown (Node.js only)
    const ErrorConstructor = Error as unknown as {
      captureStackTrace?: (target: object, constructor: Function) => void;
    };
    if (typeof ErrorConstructor.captureStackTrace === 'function') {
      ErrorConstructor.captureStackTrace(this, AgentFrameworkError);
    }
  }

  toJSON(): AgentError {
    return {
      code: this.code,
      message: this.message,
      agentType: this.agentType,
      agentId: this.agentId,
      timestamp: this.timestamp,
      stack: this.stack,
      context: this.context
    };
  }
}

/**
 * Task execution error
 */
export class TaskExecutionError extends AgentFrameworkError {
  constructor(
    message: string,
    agentType: string,
    agentId: string,
    public readonly taskId: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'TASK_EXECUTION_ERROR', agentType, agentId, {
      ...context,
      taskId
    });
    this.name = 'TaskExecutionError';
  }
}

/**
 * Worker spawn error
 */
export class WorkerSpawnError extends AgentFrameworkError {
  constructor(
    message: string,
    agentType: string,
    agentId: string,
    public readonly workerType: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'WORKER_SPAWN_ERROR', agentType, agentId, {
      ...context,
      workerType
    });
    this.name = 'WorkerSpawnError';
  }
}

/**
 * Routing error
 */
export class RoutingError extends AgentFrameworkError {
  constructor(
    message: string,
    agentType: string,
    agentId: string,
    public readonly requestPath: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'ROUTING_ERROR', agentType, agentId, {
      ...context,
      requestPath
    });
    this.name = 'RoutingError';
  }
}

/**
 * State management error
 */
export class StateError extends AgentFrameworkError {
  constructor(
    message: string,
    agentType: string,
    agentId: string,
    public readonly operation: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'STATE_ERROR', agentType, agentId, {
      ...context,
      operation
    });
    this.name = 'StateError';
  }
}

/**
 * Communication error between agents
 */
export class AgentCommunicationError extends AgentFrameworkError {
  constructor(
    message: string,
    agentType: string,
    agentId: string,
    public readonly targetAgentType: string,
    public readonly targetAgentId: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'AGENT_COMMUNICATION_ERROR', agentType, agentId, {
      ...context,
      targetAgentType,
      targetAgentId
    });
    this.name = 'AgentCommunicationError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends AgentFrameworkError {
  constructor(
    message: string,
    agentType: string,
    agentId: string,
    public readonly timeoutMs: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'TIMEOUT_ERROR', agentType, agentId, {
      ...context,
      timeoutMs
    });
    this.name = 'TimeoutError';
  }
}

/**
 * Resource not found error
 */
export class ResourceNotFoundError extends AgentFrameworkError {
  constructor(
    message: string,
    agentType: string,
    agentId: string,
    public readonly resourceType: string,
    public readonly resourceId: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'RESOURCE_NOT_FOUND', agentType, agentId, {
      ...context,
      resourceType,
      resourceId
    });
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends AgentFrameworkError {
  constructor(
    message: string,
    agentType: string,
    agentId: string,
    public readonly field: string,
    public readonly invalidValue: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', agentType, agentId, {
      ...context,
      field,
      invalidValue
    });
    this.name = 'ValidationError';
  }
}

/**
 * Capacity exceeded error
 */
export class CapacityExceededError extends AgentFrameworkError {
  constructor(
    message: string,
    agentType: string,
    agentId: string,
    public readonly currentCapacity: number,
    public readonly maxCapacity: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'CAPACITY_EXCEEDED', agentType, agentId, {
      ...context,
      currentCapacity,
      maxCapacity
    });
    this.name = 'CapacityExceededError';
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends AgentFrameworkError {
  constructor(
    message: string,
    agentType: string,
    agentId: string,
    public readonly configKey: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'CONFIGURATION_ERROR', agentType, agentId, {
      ...context,
      configKey
    });
    this.name = 'ConfigurationError';
  }
}

/**
 * Helper to wrap unknown errors as AgentFrameworkError
 */
export function wrapError(
  error: unknown,
  agentType: string,
  agentId: string,
  context?: Record<string, unknown>
): AgentFrameworkError {
  if (error instanceof AgentFrameworkError) {
    return error;
  }

  if (error instanceof Error) {
    return new AgentFrameworkError(
      error.message,
      'WRAPPED_ERROR',
      agentType,
      agentId,
      {
        ...context,
        originalError: error.name,
        originalStack: error.stack
      }
    );
  }

  return new AgentFrameworkError(
    String(error),
    'UNKNOWN_ERROR',
    agentType,
    agentId,
    context
  );
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof AgentFrameworkError) {
    const retryableCodes = [
      'TIMEOUT_ERROR',
      'AGENT_COMMUNICATION_ERROR',
      'WORKER_SPAWN_ERROR'
    ];
    return retryableCodes.includes(error.code);
  }

  // Network errors are generally retryable
  if (error.name === 'NetworkError' || error.name === 'FetchError') {
    return true;
  }

  return false;
}
