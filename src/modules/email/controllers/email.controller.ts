import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  UseGuards, 
  HttpCode, 
  HttpStatus, 
  BadRequestException 
} from '@nestjs/common';
import { EmailService } from '../services/email.service';
import { SendEmailDto } from '../dto/send-email.dto';
import { 
  NotificationConfig,
} from '../dto/email-interfaces.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/roles.enum';

@Controller('email')
@UseGuards(AuthGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  async sendEmail(@Body() sendEmailDto: SendEmailDto) {
    console.log(`Enviando email a: ${sendEmailDto.to}`);
    
    if (!sendEmailDto.to || !sendEmailDto.subject || !sendEmailDto.body) {
      throw new BadRequestException('Dirección de email, asunto y cuerpo son requeridos');
    }
    
    return await this.emailService.sendEmail(sendEmailDto);
  }

  // ENDPOINT PRINCIPAL - Maneja los 4 modos (3 legacy + 1 mixto)
  @Post('send-notification')
  @Roles(Role.ADMIN)
  async sendNotification(@Body() body: NotificationConfig) {
    console.log('Enviando notificación con configuración flexible');
    
    // Validaciones básicas de templates
    if (!body.templateName && (!body.templatesByRole || Object.keys(body.templatesByRole).length === 0)) {
      throw new BadRequestException('Se requiere templateName o templatesByRole');
    }
    
    if (!body.subject || !body.templateData) {
      throw new BadRequestException('El asunto y los datos del template son requeridos');
    }

    // Contar modos legacy especificados
    const legacyModes = [body.codigos, body.roles, body.roleFilters].filter(mode => 
      mode && (Array.isArray(mode) ? mode.length > 0 : Object.keys(mode).length > 0)
    ).length;

    // Verificar si se especificó el modo mixto
    const hasMixedTargets = body.mixedTargets && (
      (body.mixedTargets.allUsersInRoles && body.mixedTargets.allUsersInRoles.length > 0) ||
      (body.mixedTargets.specificUsers && Object.keys(body.mixedTargets.specificUsers).length > 0) ||
      (body.mixedTargets.specificCodes && body.mixedTargets.specificCodes.length > 0)
    );

    // Validar que se especifique al menos un modo
    if (legacyModes === 0 && !hasMixedTargets) {
      throw new BadRequestException('Se debe especificar al menos uno: codigos, roles, roleFilters, o mixedTargets');
    }

    // Si se usa mixedTargets, no se pueden usar los modos legacy
    if (hasMixedTargets && legacyModes > 0) {
      throw new BadRequestException('No se puede usar mixedTargets junto con codigos, roles, o roleFilters');
    }

    // Si se usan modos legacy, solo uno a la vez
    if (legacyModes > 1) {
      throw new BadRequestException('Solo se puede especificar un modo a la vez: codigos, roles, o roleFilters (o usar mixedTargets para configuración avanzada)');
    }

    // Log del modo detectado para debugging
    if (hasMixedTargets) {
      console.log('Usando modo mixto (mixedTargets)');
      if (body.mixedTargets.allUsersInRoles) {
        console.log(`- Todos los usuarios de roles: ${body.mixedTargets.allUsersInRoles.join(', ')}`);
      }
      if (body.mixedTargets.specificUsers) {
        console.log(`- Usuarios específicos por rol: ${JSON.stringify(body.mixedTargets.specificUsers)}`);
      }
      if (body.mixedTargets.specificCodes) {
        console.log(`- Códigos específicos: ${body.mixedTargets.specificCodes.join(', ')}`);
      }
    } else if (body.codigos) {
      console.log(`Usando modo 1: códigos específicos - ${body.codigos.join(', ')}`);
    } else if (body.roles) {
      console.log(`Usando modo 2: roles completos - ${body.roles.join(', ')}`);
    } else if (body.roleFilters) {
      console.log(`Usando modo 3: filtros por rol - ${JSON.stringify(body.roleFilters)}`);
    }
    
    return await this.emailService.sendNotification(body);
  }
}