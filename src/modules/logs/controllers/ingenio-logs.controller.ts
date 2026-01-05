import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Query,
  Patch,
  ParseIntPipe
} from '@nestjs/common';
import { IngenioLogsService } from '../services/ingenio-logs.service';
import { IngenioLogEntity } from 'src/models/IngenioLogEntity';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';

@UseGuards(AuthGuard)
@Controller('logs/ingenio-logs')
export class IngenioLogsController {
  constructor(private readonly logsService: IngenioLogsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.BOT)
  async create(@Body() data: Partial<IngenioLogEntity>): Promise<IngenioLogEntity> {
    return this.logsService.createLog(data);
  }

  @Get()
  @Roles(Role.ADMIN, Role.BOT)
  async getAllLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50'
  ) {
    return this.logsService.getAllLogs(parseInt(page), parseInt(limit));
  }

  @Get('rango-fechas')
  @Roles(Role.ADMIN, Role.BOT)
  async getLogsByDateRange(
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string
  ) {
    return this.logsService.getLogsByDateRange(fechaInicio, fechaFin);
  }

  @Get('usuario/:usuario')
  @Roles(Role.ADMIN, Role.BOT)
  async getByUsuario(@Param('usuario') usuario: string): Promise<IngenioLogEntity[]> {
    return this.logsService.getLogsByUsuario(usuario);
  }

  @Get('estatus/:estatus')
  @Roles(Role.ADMIN, Role.BOT)
  async getByEstatus(@Param('estatus') estatus: string): Promise<IngenioLogEntity[]> {
    return this.logsService.getLogsByEstatus(estatus);
  }

  @Get('code/:code_gen')
  @Roles(Role.ADMIN, Role.BOT)
  async getByCodeGen(@Param('code_gen') codeGen: string): Promise<IngenioLogEntity[]> {
    return this.logsService.getLogsByCodeGen(codeGen);
  }

  @Patch(':id/estatus')
  @Roles(Role.ADMIN)
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { estatus: string; motivo_invalidacion?: string }
  ): Promise<IngenioLogEntity> {
    return this.logsService.updateLogEstatus(id, data.estatus, data.motivo_invalidacion);
  }
}