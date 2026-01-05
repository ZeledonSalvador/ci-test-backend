import { Controller, Post, Get, Param, Body, UseGuards, Query } from '@nestjs/common';
import { StatusService } from '../services/status.service';
import { Status } from 'src/models/Status';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';

@Controller('status/client')
@UseGuards(AuthGuard)
export class StatusClientController {
    constructor(private readonly statusService: StatusService) { }



    @Get('shipment/:codeGen')
    @Roles(Role.BOT, Role.CLIENT, Role.ADMIN)
    async getStatusByCodeGenClient(
        @Param('codeGen') codeGen: string,
        @Query('current') current?: string,
    ): Promise<StatusResponse[]> {
        const isCurrent = current === 'true';
        return this.statusService.getStatusByCodeGen(codeGen, isCurrent, true);
    }
}
