// src/modules/notifications/services/notification.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface NotificationEvent<T = any> {
  type: string;
  eventName: string;
  data: T;
  metadata?: {
    referenceId?: number;
    referenceType?: string;
    priority?: 'low' | 'normal' | 'high';
  };
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Emitir notificación de forma asíncrona sin bloquear
   */
  async emit<T = any>(notification: NotificationEvent<T>): Promise<void> {
    try {
      this.logger.log(
        `[Notification] Emitting: ${notification.eventName} (${notification.type})`,
      );

      this.eventEmitter.emit(notification.eventName, notification);

      this.logger.debug(
        `[Notification] Event emitted: ${notification.eventName}`,
      );
    } catch (error) {
      this.logger.error(
        `[Notification] Critical error emitting: ${notification.eventName}`,
        error.stack,
      );
    }
  }
}
