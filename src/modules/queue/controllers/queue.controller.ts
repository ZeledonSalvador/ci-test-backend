import { Controller, Post, Param, Get, UseGuards, BadRequestException, Delete, Body } from '@nestjs/common';
import { QueueService } from '../services/queue.service';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';

@Controller('queue')
@UseGuards(AuthGuard)
export class QueueController {
    constructor(private readonly queueService: QueueService) { }


    @Roles(Role.ADMIN, Role.BOT)
    @Delete('release/:type')
    async releaseSlot(@Param('type') type: string) {
        return this.queueService.releaseSlot(type);
    }

    @Roles(Role.ADMIN, Role.BOT)
    @Delete('release-multiple/:type/:quantity')
    async releaseMultiple(
        @Param('type') type: string,
        @Param('quantity') quantity: number
    ) {
        const quantityNumber = parseInt(quantity.toString(), 10);
        if (isNaN(quantityNumber) || quantityNumber <= 0) {
            throw new BadRequestException('La cantidad debe ser un número mayor a 0.');
        }
        return this.queueService.releaseMultipleSlots(type, quantityNumber);
    }



    @Roles(Role.ADMIN, Role.BOT)
    @Post('call/:type')
    async call(@Param('type') type: string) {
        return this.queueService.callQueue(type);
    }

    @Roles(Role.ADMIN, Role.BOT)
    @Post('call-multiple/:type/:quantity')
    async callMultiple(
        @Param('type') type: string,
        @Param('quantity') quantity: number
    ) {
        const results = [];
        const quantityNumber = parseInt(quantity.toString(), 10);
        if (isNaN(quantityNumber) || quantityNumber <= 0) {
            throw new BadRequestException('La cantidad debe ser un número mayor a 0.');
        }
        for (let i = 0; i < quantityNumber; i++) {
            results.push(await this.queueService.callQueue(type));
        }
        return results;
    }


    @Roles(Role.ADMIN, Role.BOT)
    @Post('/send/:codeGen')
    async callNextInQueue(
        @Param('codeGen') codeGen?: string,
        @Body() body?: { 
            observationsChangeStatus?: string; 
            leveransUsernameChangeStatus?: string
         }
    ) {
        return this.queueService.sendShipment(
            codeGen,
            body.observationsChangeStatus,
            body.leveransUsernameChangeStatus
        );
    }

    @Roles(Role.ADMIN, Role.BOT)
    @Get('/count/:type')
    async getQueueWaitingCount(@Param('type') type?: string) {
        return this.queueService.getAvailableSlotsByType(type);
    }

    @Roles(Role.ADMIN, Role.BOT)
    @Get('/count')
    async getQueueWaitingCountAll() {
        return this.queueService.getAvailableSlotsForAllTypes();
    }

}
