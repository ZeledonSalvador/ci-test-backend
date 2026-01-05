// src/modules/notifications/services/retry.service.ts
import { Injectable, Logger } from '@nestjs/common';

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  exponentialBackoff?: boolean;
  onRetry?: (attempt: number, error: Error) => void | Promise<void>;
  onFinalFailure?: (error: Error) => void | Promise<void>;
}

@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);

  /**
   * Ejecutar operación con reintentos
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      delayMs = 1000,
      exponentialBackoff = true,
      onRetry,
      onFinalFailure,
    } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt < maxAttempts) {
          const delay = exponentialBackoff
            ? delayMs * Math.pow(2, attempt - 1)
            : delayMs;

          this.logger.warn(
            `[${context}] Attempt ${attempt}/${maxAttempts} failed. Retrying in ${delay}ms...`
          );

          if (onRetry) {
            await onRetry(attempt, error);
          }

          await this.sleep(delay);
        }
      }
    }

    this.logger.error(`[${context}] All attempts failed`, lastError.stack);

    if (onFinalFailure) {
      await onFinalFailure(lastError);
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}