import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TransactionLogsService } from '../services/transaction-logs.service';
import { TransactionLogEntity } from 'src/models/TransactionLogEntity';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { Query } from '@nestjs/common';

@UseGuards(AuthGuard)
@Controller('logs/transaction-logs')
export class TransactionLogsController {
  constructor(private readonly logsService: TransactionLogsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.BOT) 
  async create(@Body() data: Partial<TransactionLogEntity>): Promise<TransactionLogEntity> {
    return this.logsService.createLog(data);
  }

  @Get('rango-fechas')
    @Roles(Role.ADMIN, Role.BOT)
    async getLogsByDateRange(
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string
    ) {
    return this.logsService.getLogsByDateRange(fechaInicio, fechaFin);
    }

  @Get(':code_gen')
  @Roles(Role.ADMIN, Role.BOT)
  async getByCodeGen(@Param('code_gen') codeGen: string): Promise<TransactionLogEntity[]> {
    return this.logsService.getLogsByCodeGen(codeGen);
  }

  
  
}
