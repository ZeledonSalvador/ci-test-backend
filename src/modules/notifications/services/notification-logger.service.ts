// src/modules/notifications/services/notification-logger.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLogs } from '../../../models/NotificationLogs';

export interface LogEmailParams {
  sentBy: string;
  sentTo: string;
  subject: string;
  emailBody?: Record<string, any>; // JSON object, se convertirá a string
  status: 'sent' | 'failed';
  attempts: number;
  errorMessage?: string;
  referenceId?: number;
}

@Injectable()
export class NotificationLoggerService {
  private readonly logger = new Logger(NotificationLoggerService.name);

  constructor(
    @InjectRepository(NotificationLogs)
    private readonly notificationLogsRepository: Repository<NotificationLogs>,
  ) {}

  /**
   * Registrar envío de email de forma asíncrona
   */
  async logEmail(params: LogEmailParams): Promise<void> {
    setImmediate(async () => {
      try {
        const log = this.notificationLogsRepository.create({
          sentBy: params.sentBy,
          sentTo: params.sentTo,
          subject: params.subject,
          emailBody: params.emailBody ? JSON.stringify(params.emailBody) : null,
          status: params.status,
          attempts: params.attempts,
          errorMessage: params.errorMessage || null,
          referenceId: params.referenceId || null,
        });

        await this.notificationLogsRepository.save(log);

        this.logToConsole(params);
      } catch (error) {
        this.logger.error(`Error al guardar log de email: ${error.message}`);
      }
    });
  }

  private logToConsole(params: LogEmailParams): void {
    if (params.status === 'sent') {
      this.logger.log(
        `✓ ENVIADO: ${params.sentTo} - "${params.subject}" (Intentos: ${params.attempts})`,
      );
    } else {
      this.logger.error(
        `✗ FALLÓ: ${params.sentTo} - "${params.subject}" - ${params.errorMessage || 'Error desconocido'}`,
      );
    }
  }

  /**
   * Obtener logs con filtros
   */
  async getLogs(filters: {
    sentBy?: string;
    sentTo?: string;
    status?: string;
    referenceId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<NotificationLogs[]> {
    const queryBuilder =
      this.notificationLogsRepository.createQueryBuilder('log');

    if (filters.sentBy) {
      queryBuilder.andWhere('log.sentBy = :sentBy', { sentBy: filters.sentBy });
    }

    if (filters.sentTo) {
      queryBuilder.andWhere('log.sentTo LIKE :sentTo', {
        sentTo: `%${filters.sentTo}%`,
      });
    }

    if (filters.status) {
      queryBuilder.andWhere('log.status = :status', { status: filters.status });
    }

    if (filters.referenceId) {
      queryBuilder.andWhere('log.referenceId = :referenceId', {
        referenceId: filters.referenceId,
      });
    }

    if (filters.startDate) {
      queryBuilder.andWhere('log.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      queryBuilder.andWhere('log.createdAt <= :endDate', {
        endDate: filters.endDate,
      });
    }

    queryBuilder.orderBy('log.createdAt', 'DESC').take(filters.limit || 100);

    return queryBuilder.getMany();
  }

  /**
   * Obtener estadísticas simples
   */
  async getStats(filters: {
    sentBy?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    total: number;
    sent: number;
    failed: number;
    successRate: number;
  }> {
    const queryBuilder =
      this.notificationLogsRepository.createQueryBuilder('log');

    if (filters.sentBy) {
      queryBuilder.andWhere('log.sentBy = :sentBy', { sentBy: filters.sentBy });
    }

    if (filters.startDate) {
      queryBuilder.andWhere('log.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      queryBuilder.andWhere('log.createdAt <= :endDate', {
        endDate: filters.endDate,
      });
    }

    const [logs, total] = await queryBuilder.getManyAndCount();

    const sent = logs.filter((log) => log.status === 'sent').length;
    const failed = logs.filter((log) => log.status === 'failed').length;
    const successRate = total > 0 ? (sent / total) * 100 : 0;

    return {
      total,
      sent,
      failed,
      successRate: parseFloat(successRate.toFixed(2)),
    };
  }

  /**
   * Obtener logs de un reporte específico
   */
  async getLogsByReference(referenceId: number): Promise<NotificationLogs[]> {
    return this.notificationLogsRepository.find({
      where: { referenceId },
      order: { createdAt: 'DESC' },
    });
  }
}
