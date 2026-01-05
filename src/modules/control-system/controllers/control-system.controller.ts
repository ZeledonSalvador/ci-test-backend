import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ControlSystemService } from '../services/control-system.service';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';


@UseGuards(AuthGuard)
@Controller('control-system')
export class ControlSystemController {
    constructor(private readonly controlSystemService: ControlSystemService) { }

    @Get()
    @Roles(Role.ADMIN, Role.BOT)
    async getFullSystemInfo(): Promise<any> {
        return this.controlSystemService.getFullSystemInfo();
    }

    @Post('restart-monitoring-system')
    @Roles(Role.ADMIN, Role.BOT)
    async reStartMonitoringSystem(): Promise<any> {
        return this.controlSystemService.reStartMonitoringSystemInApiMiddlewareControlSystem();
    }

    @Post('start-monitoring-system')
    @Roles(Role.ADMIN, Role.BOT)
    async startMonitoringSystem(): Promise<any> {
        return this.controlSystemService.startMonitoringSystemInApiMiddlewareControlSystem();
    }

    @Post('stop-monitoring-system')
    @Roles(Role.ADMIN, Role.BOT)
    async stopMonitoringSystem(): Promise<any> {
        return this.controlSystemService.stopMonitoringSystemInApiMiddlewareControlSystem();
    }
}
