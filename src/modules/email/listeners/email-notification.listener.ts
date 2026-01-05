// src/modules/email/listeners/email-notification.listener.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../services/email.service';
import { RetryService } from '../../notifications/services/retry.service';
import { NotificationLoggerService } from '../../notifications/services/notification-logger.service';
import { NotificationEvent } from '../../notifications/services/notification.service';
import { EmailNotificationData } from '../dto/email-interfaces.dto';

@Injectable()
export class EmailNotificationListener {
  private readonly logger = new Logger(EmailNotificationListener.name);
  private readonly emailFrom: string;

  constructor(
    private readonly emailService: EmailService,
    private readonly retryService: RetryService,
    private readonly notificationLogger: NotificationLoggerService,
    private readonly configService: ConfigService,
  ) {
    this.emailFrom = this.configService.get<string>('EMAIL_FROM') || 'sistema@almapac.com';
  }

  /**
   * Manejar eventos de email de forma asíncrona
   * Patrón '**.email' captura cualquier evento que termine en .email
   */
  @OnEvent('**.email', { async: true })
  async handleEmailNotification(event: NotificationEvent<EmailNotificationData>) {
    const { eventName, data, metadata } = event;
    const maxAttempts = 3;
    let currentAttempt = 0;

    this.logger.log(`[Email Listener] Capturado evento: ${eventName}`);

    try {
      await this.retryService.executeWithRetry(
        async () => {
          currentAttempt++;
          this.logger.log(`[Email Listener] Enviando notificación... (Intento ${currentAttempt}/${maxAttempts})`);
          
          const result = await this.emailService.sendNotification(data);
          
          this.logger.log(`[Email Listener] Notificación enviada exitosamente`);
          
          // LOG DE CADA EMAIL INDIVIDUAL
          if (result.details && result.details.length > 0) {
            for (const detail of result.details) {
              await this.notificationLogger.logEmail({
                sentBy: this.emailFrom,
                sentTo: detail.recipient,
                subject: data.subject,
                emailBody: data.templateData,
                status: detail.status === 'sent' ? 'sent' : 'failed',
                attempts: currentAttempt,
                errorMessage: detail.error || undefined,
                referenceId: metadata?.referenceId,
              });
            }
          }

          return result;
        },
        `Email:${eventName}`,
        {
          maxAttempts,
          delayMs: 2000,
          exponentialBackoff: true,
          onRetry: async (attempt, error) => {
            this.logger.warn(`[Email Listener] Reintento ${attempt + 1}/${maxAttempts}: ${error.message}`);
          },
          onFinalFailure: async (error) => {
            this.logger.error(`[Email Listener] Error final después de ${maxAttempts} intentos: ${error.message}`);
          },
        }
      );
    } catch (error) {
      this.logger.error(`[Email Listener] Error no recuperable para ${eventName}:`, error.stack);
    }
  }
}