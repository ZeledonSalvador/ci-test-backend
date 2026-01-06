import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Client } from '@microsoft/microsoft-graph-client';
import { GraphAuthService } from '../../graph/services/graph-auth.service';
import { EmailUsers } from '../../../models/EmailUsers';
import { SendEmailDto } from '../dto/send-email.dto';
import {
  NotificationResult,
  SendEmailResult,
  NotificationDetail,
  EmailTemplateData,
} from '../dto/email-interfaces.dto';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private graphClient: Client;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly templatesDir: string;
  private readonly portalClientesUrl: string;
  private readonly quickpassUrl: string;

  constructor(
    @InjectRepository(EmailUsers)
    private emailUsersRepository: Repository<EmailUsers>,
    private configService: ConfigService,
    private graphAuthService: GraphAuthService,
  ) {
    this.fromEmail = this.configService.get<string>('EMAIL_FROM');
    this.fromName =
      this.configService.get<string>('FROM_NAME') || 'Notificaciones ALMAPAC';
    this.templatesDir =
      this.configService.get<string>('TEMPLATE_DIR') ||
      './src/modules/email/templates';
    this.portalClientesUrl =
      this.configService.get<string>('PORTAL_CLIENTES') ||
      'http://192.168.200.112:2053';
    this.quickpassUrl =
      this.configService.get<string>('QUICKPASS') ||
      'https://sv-svr-almapp05.almapac.com:2057/Login';

    this.initializeGraphClient();
  }

  private initializeGraphClient(): void {
    try {
      if (!this.fromEmail) {
        this.logger.error(
          'La variable EMAIL_FROM es requerida pero no está configurada',
        );
        return;
      }

      if (!this.graphAuthService.isReady()) {
        this.logger.error('GraphAuthService no está listo');
        return;
      }

      this.graphClient = this.graphAuthService.createGraphClient();
      this.logger.log('EmailService Graph Client inicializado correctamente');
    } catch (error) {
      this.logger.error(
        'Error al inicializar Graph Client en EmailService:',
        error,
      );
    }
  }

  async sendEmail(sendEmailDto: SendEmailDto): Promise<SendEmailResult> {
    if (!this.graphClient) {
      throw new InternalServerErrorException(
        'Servicio de email no inicializado correctamente',
      );
    }

    try {
      const { to, username, subject, body } = sendEmailDto;

      this.validateEmailContent(subject, body);
      this.validateEmailAddress(to);

      const message = {
        subject: this.sanitizeSubject(subject),
        body: {
          contentType: 'HTML',
          content: body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
              name: username || to,
            },
          },
        ],
        from: {
          emailAddress: {
            address: this.fromEmail,
            name: this.fromName,
          },
        },
        internetMessageHeaders: [
          {
            name: 'X-MS-Exchange-Organization-SCL',
            value: '-1',
          },
        ],
        importance: 'normal',
      };

      const response = await this.graphClient
        .api(`/users/${this.fromEmail}/sendMail`)
        .post({ message });

      this.logger.log(
        `Email enviado exitosamente a ${to} con asunto: ${subject}`,
      );

      return {
        success: true,
        message: 'Email enviado exitosamente',
        messageId: response?.id || 'desconocido',
      };
    } catch (error) {
      this.logger.error(`Error al enviar email a ${sendEmailDto.to}:`, error);
      throw new InternalServerErrorException(
        `Error al enviar email: ${error.message}`,
      );
    }
  }

  async sendNotification(config: {
    templateName?: string;
    templatesByRole?: Record<number, string>;
    codigos?: string[];
    roles?: number[];
    roleFilters?: Record<number, string[]>;
    mixedTargets?: {
      allUsersInRoles?: number[];
      specificUsers?: Record<number, string[]>;
      specificCodes?: string[];
    };
    subject: string;
    templateData: Record<string, any>;
    priority?: 'low' | 'normal' | 'high';
  }): Promise<NotificationResult> {
    try {
      if (!this.graphClient) {
        throw new InternalServerErrorException(
          'Servicio de email no inicializado correctamente',
        );
      }

      this.validateNotificationConfig(config);
      const recipients = await this.getRecipientsByMode(config);
      return await this.sendNotificationsToRecipients(recipients, config);
    } catch (error) {
      this.logger.error('Error en sendNotification:', error);
      throw new InternalServerErrorException(
        `Error al enviar notificación: ${error.message}`,
      );
    }
  }

  private validateNotificationConfig(config: any): void {
    const {
      templateName,
      templatesByRole,
      subject,
      templateData,
      codigos,
      roles,
      roleFilters,
      mixedTargets,
    } = config;

    // Validar templates
    if (
      !templateName &&
      (!templatesByRole || Object.keys(templatesByRole).length === 0)
    ) {
      throw new BadRequestException(
        'Se debe proporcionar templateName o templatesByRole',
      );
    }

    if (!subject || !templateData) {
      throw new BadRequestException(
        'El asunto y los datos del template son requeridos',
      );
    }

    // Contar modos especificados
    const legacyModes = [codigos, roles, roleFilters].filter(
      (mode) =>
        mode &&
        (Array.isArray(mode) ? mode.length > 0 : Object.keys(mode).length > 0),
    ).length;

    const hasMixedTargets =
      mixedTargets &&
      ((mixedTargets.allUsersInRoles &&
        mixedTargets.allUsersInRoles.length > 0) ||
        (mixedTargets.specificUsers &&
          Object.keys(mixedTargets.specificUsers).length > 0) ||
        (mixedTargets.specificCodes && mixedTargets.specificCodes.length > 0));

    if (legacyModes === 0 && !hasMixedTargets) {
      throw new BadRequestException(
        'Se debe especificar al menos uno: codigos, roles, roleFilters, o mixedTargets',
      );
    }

    if (hasMixedTargets && legacyModes > 0) {
      throw new BadRequestException(
        'No se puede usar mixedTargets junto con codigos, roles, o roleFilters',
      );
    }

    if (legacyModes > 1) {
      throw new BadRequestException(
        'Solo se puede especificar un modo a la vez: codigos, roles, o roleFilters (o usar mixedTargets para configuración avanzada)',
      );
    }
  }

  private async getRecipientsByMode(config: any): Promise<EmailUsers[]> {
    const { codigos, roles, roleFilters, mixedTargets } = config;

    if (mixedTargets) {
      return this.getRecipientsByMixedTargets(mixedTargets);
    }

    if (codigos && codigos.length > 0) {
      return this.getRecipientsByCodes(codigos);
    }

    if (roles && roles.length > 0) {
      return this.getRecipientsByRoles(roles);
    }

    if (roleFilters && Object.keys(roleFilters).length > 0) {
      return this.getRecipientsByRoleFilters(roleFilters);
    }

    throw new BadRequestException(
      'No se pudo determinar el modo de selección de destinatarios',
    );
  }

  private async getRecipientsByMixedTargets(mixedTargets: {
    allUsersInRoles?: number[];
    specificUsers?: Record<number, string[]>;
    specificCodes?: string[];
  }): Promise<EmailUsers[]> {
    const allRecipients: EmailUsers[] = [];

    // 1. Obtener todos los usuarios de roles específicos
    if (
      mixedTargets.allUsersInRoles &&
      mixedTargets.allUsersInRoles.length > 0
    ) {
      const roleRecipients = await this.emailUsersRepository
        .createQueryBuilder('user')
        .where('user.active = :active', { active: true })
        .andWhere('user.id_rol IN (:...roles)', {
          roles: mixedTargets.allUsersInRoles,
        })
        .getMany();

      allRecipients.push(...roleRecipients);
      this.logger.log(
        `MixedTargets - Encontrados ${roleRecipients.length} destinatarios para todos los usuarios de roles: ${mixedTargets.allUsersInRoles.join(', ')}`,
      );
    }

    // 2. Obtener usuarios específicos por rol y código
    if (
      mixedTargets.specificUsers &&
      Object.keys(mixedTargets.specificUsers).length > 0
    ) {
      for (const [roleStr, codigos] of Object.entries(
        mixedTargets.specificUsers,
      )) {
        const role = parseInt(roleStr);

        const specificRecipients = await this.emailUsersRepository
          .createQueryBuilder('user')
          .where('user.active = :active', { active: true })
          .andWhere('user.id_rol = :role', { role })
          .andWhere('user.codigo IN (:...codigos)', { codigos })
          .getMany();

        allRecipients.push(...specificRecipients);
        this.logger.log(
          `MixedTargets - Encontrados ${specificRecipients.length} destinatarios específicos para rol ${role} con códigos: ${codigos.join(', ')}`,
        );
      }
    }

    // 3. Obtener usuarios por códigos sin importar el rol
    if (mixedTargets.specificCodes && mixedTargets.specificCodes.length > 0) {
      const codeRecipients = await this.emailUsersRepository
        .createQueryBuilder('user')
        .where('user.active = :active', { active: true })
        .andWhere('user.codigo IN (:...codigos)', {
          codigos: mixedTargets.specificCodes,
        })
        .getMany();

      allRecipients.push(...codeRecipients);
      this.logger.log(
        `MixedTargets - Encontrados ${codeRecipients.length} destinatarios por códigos específicos: ${mixedTargets.specificCodes.join(', ')}`,
      );
    }

    if (allRecipients.length === 0) {
      throw new BadRequestException(
        'No se encontraron usuarios activos para los criterios mixtos especificados',
      );
    }

    // Eliminar duplicados por ID
    const uniqueRecipients = allRecipients.filter(
      (recipient, index, self) =>
        index === self.findIndex((r) => r.id === recipient.id),
    );

    this.logger.log(
      `MixedTargets - Total de destinatarios únicos: ${uniqueRecipients.length}`,
    );
    return uniqueRecipients;
  }

  // MODO 1: Por códigos específicos
  private async getRecipientsByCodes(codigos: string[]): Promise<EmailUsers[]> {
    const recipients = await this.emailUsersRepository
      .createQueryBuilder('user')
      .where('user.active = :active', { active: true })
      .andWhere('user.codigo IN (:...codigos)', { codigos })
      .getMany();

    if (recipients.length === 0) {
      throw new BadRequestException(
        `No se encontraron usuarios activos con códigos: ${codigos.join(', ')}`,
      );
    }

    this.logger.log(
      `Modo 1 - Encontrados ${recipients.length} destinatarios por códigos: ${codigos.join(', ')}`,
    );
    return recipients;
  }

  // MODO 2: Por roles
  private async getRecipientsByRoles(roles: number[]): Promise<EmailUsers[]> {
    const recipients = await this.emailUsersRepository
      .createQueryBuilder('user')
      .where('user.active = :active', { active: true })
      .andWhere('user.id_rol IN (:...roles)', { roles })
      .getMany();

    if (recipients.length === 0) {
      throw new BadRequestException(
        `No se encontraron usuarios activos para los roles: ${roles.join(', ')}`,
      );
    }

    this.logger.log(
      `Modo 2 - Encontrados ${recipients.length} destinatarios para roles: ${roles.join(', ')}`,
    );
    return recipients;
  }

  // MODO 3: Por roles con códigos específicos
  private async getRecipientsByRoleFilters(
    roleFilters: Record<number, string[]>,
  ): Promise<EmailUsers[]> {
    const allRecipients: EmailUsers[] = [];

    for (const [roleStr, codigos] of Object.entries(roleFilters)) {
      const role = parseInt(roleStr);

      const recipients = await this.emailUsersRepository
        .createQueryBuilder('user')
        .where('user.active = :active', { active: true })
        .andWhere('user.id_rol = :role', { role })
        .andWhere('user.codigo IN (:...codigos)', { codigos })
        .getMany();

      allRecipients.push(...recipients);

      this.logger.log(
        `Modo 3 - Encontrados ${recipients.length} destinatarios para rol ${role} con códigos: ${codigos.join(', ')}`,
      );
    }

    if (allRecipients.length === 0) {
      const filterDesc = Object.entries(roleFilters)
        .map(([role, codigos]) => `rol ${role}: ${codigos.join(', ')}`)
        .join(' | ');
      throw new BadRequestException(
        `No se encontraron usuarios activos para los filtros: ${filterDesc}`,
      );
    }

    // Eliminar duplicados por ID
    const uniqueRecipients = allRecipients.filter(
      (recipient, index, self) =>
        index === self.findIndex((r) => r.id === recipient.id),
    );

    this.logger.log(
      `Modo 3 - Total de destinatarios únicos: ${uniqueRecipients.length}`,
    );
    return uniqueRecipients;
  }

  private determineTemplateForRecipient(
    recipient: EmailUsers,
    config: any,
  ): string {
    const { templateName, templatesByRole } = config;

    if (templatesByRole && templatesByRole[recipient.id_rol]) {
      return templatesByRole[recipient.id_rol];
    }

    if (templateName) {
      return templateName;
    }

    throw new Error(`No se encontró template para el rol ${recipient.id_rol}`);
  }

  private buildRecipientTemplateData(
    recipient: EmailUsers,
    config: any,
  ): EmailTemplateData {
    return {
      ...config.templateData,
      recipientName: recipient.name,
      recipientRole: recipient.id_rol,
      recipientCodigo: recipient.codigo,
      currentYear: new Date().getFullYear(),
      fromName: this.fromName,
    };
  }

  private async sendSingleNotification(
    recipient: EmailUsers,
    config: any,
  ): Promise<NotificationDetail> {
    try {
      const templateName = this.determineTemplateForRecipient(
        recipient,
        config,
      );
      const templateData = this.buildRecipientTemplateData(recipient, config);

      const renderedBody = await this.renderTemplate(
        templateName,
        templateData,
      );
      this.validateEmailContent(config.subject, renderedBody);

      const message = {
        subject: this.sanitizeSubject(config.subject),
        body: {
          contentType: 'HTML',
          content: renderedBody,
        },
        toRecipients: [
          {
            emailAddress: {
              address: recipient.email,
              name: recipient.username,
            },
          },
        ],
        from: {
          emailAddress: {
            address: this.fromEmail,
            name: this.fromName,
          },
        },
        internetMessageHeaders: [
          {
            name: 'X-MS-Exchange-Organization-SCL',
            value: '-1',
          },
        ],
        importance: config.priority || 'normal',
      };

      await this.graphClient
        .api(`/users/${this.fromEmail}/sendMail`)
        .post({ message });

      this.logger.log(
        `Notificación enviada al rol ${recipient.id_rol} (${recipient.codigo}): ${recipient.email} usando template: ${templateName}`,
      );

      return {
        recipient: recipient.email,
        role: recipient.id_rol,
        codigo: recipient.codigo,
        templateUsed: templateName,
        status: 'sent',
      };
    } catch (error) {
      const errorMsg = error.message || 'Error desconocido';

      this.logger.error(
        `Error al enviar notificación a ${recipient.email}: ${errorMsg}`,
      );

      return {
        recipient: recipient.email,
        role: recipient.id_rol,
        codigo: recipient.codigo,
        templateUsed:
          this.determineTemplateForRecipient(recipient, config) ||
          'desconocido',
        status: 'failed',
        error: errorMsg,
      };
    }
  }

  private async sendNotificationsToRecipients(
    recipients: EmailUsers[],
    config: any,
  ): Promise<NotificationResult> {
    let sentCount = 0;
    const details: NotificationDetail[] = [];

    this.logger.log(
      `Iniciando envío de notificaciones a ${recipients.length} destinatarios`,
    );

    for (const recipient of recipients) {
      const result = await this.sendSingleNotification(recipient, config);
      details.push(result);

      if (result.status === 'sent') {
        sentCount++;
      }
    }

    const message = `Notificación enviada a ${sentCount}/${recipients.length} destinatarios${sentCount < recipients.length ? ` (${recipients.length - sentCount} fallaron)` : ''}`;
    this.logger.log(message);

    return {
      success: sentCount > 0,
      message,
      sentCount,
      details,
    };
  }

  private async renderTemplate(
    templateName: string,
    data: EmailTemplateData,
  ): Promise<string> {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);

      if (!fs.existsSync(templatePath)) {
        this.logger.error(
          `Template ${templateName} no encontrado en ${templatePath}`,
        );
        throw new Error(`Template ${templateName} no encontrado`);
      }

      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateContent);

      const renderedContent = template({
        ...data,
        fromName: this.fromName,
        portalClientesUrl: this.portalClientesUrl,
        quickpassUrl: this.quickpassUrl,
        currentDate: new Date().toLocaleString('es-ES', {
          timeZone: 'America/El_Salvador',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      });

      this.logger.log(`Template ${templateName} renderizado exitosamente`);
      return renderedContent;
    } catch (error) {
      this.logger.error(`Error al renderizar template ${templateName}:`, error);
      throw new Error(
        `Error al renderizar template ${templateName}: ${error.message}`,
      );
    }
  }

  private validateEmailContent(subject: string, body: string): void {
    if (!subject || subject.trim().length === 0) {
      throw new BadRequestException('El asunto no puede estar vacío');
    }

    if (subject.length > 998) {
      throw new BadRequestException(
        'Asunto demasiado largo (máximo 998 caracteres)',
      );
    }

    const spamWords = [
      'URGENTE',
      'GRATIS',
      'GANADOR',
      'FELICITACIONES',
      'HAZ CLICK AQUI',
      'TIEMPO LIMITADO',
    ];
    const upperSubject = subject.toUpperCase();
    const foundSpamWords = spamWords.filter((word) =>
      upperSubject.includes(word),
    );

    if (foundSpamWords.length > 0) {
      this.logger.warn(
        `Palabras potencialmente spam detectadas en el asunto: ${foundSpamWords.join(', ')}`,
      );
    }

    if (!body || body.trim().length === 0) {
      throw new BadRequestException(
        'El cuerpo del mensaje no puede estar vacío',
      );
    }

    const upperCaseCount = (subject.match(/[A-Z]/g) || []).length;
    const upperCasePercentage = (upperCaseCount / subject.length) * 100;

    if (upperCasePercentage > 70) {
      this.logger.warn(
        'Alto porcentaje de caracteres en mayúscula detectado en el asunto',
      );
    }
  }

  private validateEmailAddress(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Formato de dirección de email inválido');
    }

    const disposableEmailDomains = [
      '10minutemail.com',
      'tempmail.org',
      'guerrillamail.com',
    ];
    const domain = email.split('@')[1].toLowerCase();

    if (disposableEmailDomains.includes(domain)) {
      this.logger.warn(`Dominio de email desechable detectado: ${domain}`);
    }
  }

  private sanitizeSubject(subject: string): string {
    return subject
      .replace(/[\r\n\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 255);
  }
}
