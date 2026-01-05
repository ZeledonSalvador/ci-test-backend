import { Controller, Get, Post, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { OperationTimesService } from '../services/operation-times.service';
import { CreateOperationTimeDto } from '../dto/create-operation-time.dto';
import { OperationTime } from '../types/operation-time.entity';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@UseGuards(AuthGuard)
@Controller('operation-times')
export class OperationTimesController {
  constructor(private readonly service: OperationTimesService) {
    console.log('✅ OperationTimesController cargado');
  }

  @Get('ping')
  ping() {
    return { message: 'pong!' };
  }

  @Post()
  @Roles(Role.ADMIN, Role.BOT) // 👈 solo estos roles pueden ejecutar POST
  async create(@Req() req: Request): Promise<OperationTime> {
    const rawBody = req.body;

    console.log('📦 Datos crudos recibidos en el body:');
    for (const [key, value] of Object.entries(rawBody)) {
      console.log(`- ${key}:`, value, '| Tipo:', typeof value);
    }

    const dto = plainToInstance(CreateOperationTimeDto, rawBody);
    const errors = await validate(dto);

    if (errors.length > 0) {
      console.error('❌ Errores de validación:', errors);
      throw new BadRequestException(errors);
    }

    return this.service.create(dto);
  }
}
