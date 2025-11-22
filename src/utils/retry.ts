/**
 * Retry logic utilities for agent operations
 */

import { isRetryableError } from './errors';

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: (error: Error) => boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: isRetryableError
};

/**
 * Retry result
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

/**
 * Execute a function with retry logic
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  let attempt = 0;
  let delay = finalConfig.initialDelayMs;
  let lastError: Error | undefined;

  while (attempt < finalConfig.maxAttempts) {
    attempt++;

    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const shouldRetry = finalConfig.retryableErrors
        ? finalConfig.retryableErrors(lastError)
        : true;

      if (!shouldRetry || attempt >= finalConfig.maxAttempts) {
        throw lastError;
      }

      // Wait before retry
      await sleep(Math.min(delay, finalConfig.maxDelayMs));

      // Calculate next delay with exponential backoff
      delay *= finalConfig.backoffMultiplier;
    }
  }

  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Execute a function with detailed retry result
 */
export async function retryWithResult<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const startTime = Date.now();

  let attempt = 0;
  let delay = finalConfig.initialDelayMs;
  let lastError: Error | undefined;

  while (attempt < finalConfig.maxAttempts) {
    attempt++;

    try {
      const result = await fn();
      return {
        success: true,
        result,
        attempts: attempt,
        totalDuration: Date.now() - startTime
      };
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const shouldRetry = finalConfig.retryableErrors
        ? finalConfig.retryableErrors(lastError)
        : true;

      if (!shouldRetry || attempt >= finalConfig.maxAttempts) {
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalDuration: Date.now() - startTime
        };
      }

      // Wait before retry
      await sleep(Math.min(delay, finalConfig.maxDelayMs));

      // Calculate next delay
      delay *= finalConfig.backoffMultiplier;
    }
  }

  return {
    success: false,
    error: lastError || new Error('Retry failed with unknown error'),
    attempts: attempt,
    totalDuration: Date.now() - startTime
  };
}

/**
 * Retry with jitter to prevent thundering herd
 */
export async function retryWithJitter<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  let attempt = 0;
  let delay = finalConfig.initialDelayMs;
  let lastError: Error | undefined;

  while (attempt < finalConfig.maxAttempts) {
    attempt++;

    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const shouldRetry = finalConfig.retryableErrors
        ? finalConfig.retryableErrors(lastError)
        : true;

      if (!shouldRetry || attempt >= finalConfig.maxAttempts) {
        throw lastError;
      }

      // Add jitter: random value between 0 and current delay
      const jitter = Math.random() * delay;
      const delayWithJitter = Math.min(delay + jitter, finalConfig.maxDelayMs);

      await sleep(delayWithJitter);

      // Calculate next delay
      delay *= finalConfig.backoffMultiplier;
    }
  }

  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Batch retry - retry multiple operations with coordinated backoff
 */
export async function batchRetry<T>(
  operations: Array<() => Promise<T>>,
  config: Partial<RetryConfig> = {}
): Promise<Array<RetryResult<T>>> {
  const results = await Promise.all(
    operations.map(op => retryWithResult(op, config))
  );

  return results;
}

/**
 * Retry decorator for class methods
 */
export function Retryable(config: Partial<RetryConfig> = {}) {
  return function(
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: unknown[]) {
      return retry(() => originalMethod.apply(this, args), config);
    };

    return descriptor;
  };
}

/**
 * Retry queue for managing multiple retry operations
 */
export class RetryQueue<T> {
  private queue: Array<{
    id: string;
    fn: () => Promise<T>;
    config: RetryConfig;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
  }> = [];

  private processing = false;

  /**
   * Add an operation to the retry queue
   */
  async enqueue(
    id: string,
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id,
        fn,
        config: finalConfig,
        resolve,
        reject
      });

      this.processQueue();
    });
  }

  /**
   * Process queued operations
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      try {
        const result = await retry(item.fn, item.config);
        item.resolve(result);
      } catch (error) {
        item.reject(error as Error);
      }
    }

    this.processing = false;
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
  }
}
