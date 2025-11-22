/**
 * ID generation utilities for agents and tasks
 */

/**
 * Generate a unique ID with optional prefix
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const id = `${timestamp}-${randomPart}`;
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * Generate a worker ID
 */
export function generateWorkerId(workerType: string): string {
  return generateId(`worker-${workerType}`);
}

/**
 * Generate a task ID
 */
export function generateTaskId(taskType: string): string {
  return generateId(`task-${taskType}`);
}

/**
 * Generate a batch ID
 */
export function generateBatchId(): string {
  return generateId('batch');
}

/**
 * Generate a coordinator ID
 */
export function generateCoordinatorId(coordinatorType: string): string {
  return generateId(`coord-${coordinatorType}`);
}

/**
 * Generate a schedule ID
 */
export function generateScheduleId(): string {
  return generateId('schedule');
}

/**
 * Generate a watch ID
 */
export function generateWatchId(): string {
  return generateId('watch');
}

/**
 * Generate a pipeline execution ID
 */
export function generateExecutionId(pipelineId: string): string {
  return `${pipelineId}-exec-${Date.now().toString(36)}`;
}

/**
 * Generate a correlation ID for tracing related operations
 */
export function generateCorrelationId(): string {
  return generateId('corr');
}

/**
 * Parse an ID to extract its prefix and components
 */
export function parseId(id: string): { prefix?: string; timestamp: string; random: string } {
  const parts = id.split('-');

  if (parts.length === 2) {
    // No prefix
    return {
      timestamp: parts[0]!,
      random: parts[1]!
    };
  } else if (parts.length >= 3) {
    // Has prefix
    const prefix = parts.slice(0, -2).join('-');
    const timestamp = parts[parts.length - 2]!;
    const random = parts[parts.length - 1]!;

    return {
      prefix,
      timestamp,
      random
    };
  }

  throw new Error(`Invalid ID format: ${id}`);
}

/**
 * Extract timestamp from ID
 */
export function getIdTimestamp(id: string): number {
  const parsed = parseId(id);
  return parseInt(parsed.timestamp, 36);
}

/**
 * Check if an ID was generated within a certain time window
 */
export function isIdRecent(id: string, maxAgeMs: number): boolean {
  const idTime = getIdTimestamp(id);
  const now = Date.now();
  return (now - idTime) <= maxAgeMs;
}

/**
 * Create a deterministic ID from a set of inputs (useful for idempotency)
 */
export async function createDeterministicId(
  inputs: string[],
  prefix?: string
): Promise<string> {
  // Concatenate inputs
  const combined = inputs.join('|');

  // Create hash using crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Take first 12 characters of hash
  const shortHash = hashHex.substring(0, 12);

  return prefix ? `${prefix}-${shortHash}` : shortHash;
}
