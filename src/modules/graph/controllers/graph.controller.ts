import { Controller, Get, UseGuards } from '@nestjs/common';
import { GraphAuthService } from '../services/graph-auth.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/roles.enum';

@Controller('graph')
@UseGuards(AuthGuard)
export class GraphController {
  constructor(private readonly graphAuthService: GraphAuthService) {}

  @Get('test-connection')
  @Roles(Role.ADMIN)
  async testConnection() {
    console.log('Probando conexión de Microsoft Graph API');
    return await this.graphAuthService.testConnection();
  }

  @Get('test-configuration')
  @Roles(Role.ADMIN)
  async testConfiguration() {
    console.log('Probando configuración de Microsoft Graph API');
    return await this.graphAuthService.testConfiguration();
  }
}