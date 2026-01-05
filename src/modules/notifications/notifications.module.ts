// src/modules/notifications/notifications.module.ts
import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './services/notification.service';
import { NotificationLoggerService } from './services/notification-logger.service';
import { RetryService } from './services/retry.service';
import { NotificationLogs } from '../../models/NotificationLogs';

@Global() // ← IMPORTANTE: Esto hace que los providers estén disponibles globalmente
@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationLogs])
  ],
  providers: [
    NotificationService,
    NotificationLoggerService,
    RetryService
  ],
  exports: [
    NotificationService,
    NotificationLoggerService,
    RetryService
  ]
})
export class NotificationsModule {}