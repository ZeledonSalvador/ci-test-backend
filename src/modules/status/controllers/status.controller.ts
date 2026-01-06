import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { StatusService } from '../services/status.service';
import { Status } from 'src/models/Status';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';

@Controller('status')
@UseGuards(AuthGuard)
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  /* 
        En realidad solamente un bot (un programa interno)
        podria cambiar el estado de un envio, y nadie mas
    */
  @Post('push')
  @Roles(Role.BOT, Role.ADMIN)
  async addStatusByCodeGen(
    @Body()
    body: {
      codeGen: string;
      predefinedStatusId: number;
      observation?: string;
      leveransUsername?: string;
    },
  ): Promise<Status> {
    const { codeGen, predefinedStatusId, observation, leveransUsername } = body;
    return this.statusService.updateStatusesForShipment(
      codeGen,
      predefinedStatusId,
      observation,
      leveransUsername,
    );
  }

  @Get('shipment/:codeGen')
  @Roles(Role.BOT, Role.ADMIN)
  async getStatusByCodeGen(
    @Param('codeGen') codeGen: string,
    @Query('current') current?: string,
  ): Promise<StatusResponse[]> {
    const isCurrent = current === 'true';
    return this.statusService.getStatusByCodeGen(codeGen, isCurrent);
  }
}
