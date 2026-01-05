import { Controller, Post, Body, Get, Param, Query, UseGuards, Put, Res } from '@nestjs/common';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { ShipmentsService } from '../services/shipments.service';
import { Role } from 'src/modules/auth/enums/roles.enum';
import ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse from '../interfaces/ShipmentsWithFormattedStatusesAndFormatResponse.interface';
import { Response } from 'express';
import { PaginationInfo } from 'src/dto/pagination';
import { Shipments } from 'src/models/Shipments';
import { ShipmentsUpdateService } from '../services/shipments-update.service';


@UseGuards(AuthGuard)
@Controller('shipping/client')
export class ShippingClientController {
    constructor(
        private readonly shipmentsService: ShipmentsService,
        private readonly shipmentsUpdateService: ShipmentsUpdateService
    ) { }

    @Get(':code_gen')
    @Roles(Role.CLIENT, Role.ADMIN, Role.BOT)
    async getShipmentByCode(
        @Param('code_gen') codeGen: string,
        @Query('includeAttachments') includeAttachments: string
    ): Promise<ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse> {
        return this.shipmentsService.getShipmentByCode(
            codeGen,
            includeAttachments === 'true',
            true
        );
    }

    @Get('ingenio/:codigo_ingenio')
    @Roles(Role.CLIENT, Role.ADMIN, Role.BOT)
    async getShipmentsByIngenio(
        @Param('codigo_ingenio') codigoIngenio: string,
        @Res() res: Response,
        @Query('page') page?: number,
        @Query('size') size?: number,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ): Promise<void> {
        const defaultPage = 1;
        const defaultSize = 10;
        const currentPage = isNaN(page) ? defaultPage : page;
        const currentSize = isNaN(size) ? defaultSize : size;
        const start = startDate ? new Date(`${startDate}T00:00:00`) : undefined;
        const end = endDate ? new Date(`${endDate}T23:59:59`) : undefined;
        const { data, pagination } = await this.shipmentsService.getShipmentsByIngenio(
            codigoIngenio, currentPage, currentSize, start, end, true
        );
        res.set(new PaginationInfo(pagination).headers);
        res.status(200).json(data);
    }


    @Put(':codigo_gen')
    @Roles(Role.ADMIN, Role.CLIENT, Role.BOT)
    async updateShipment(
        @Param('codigo_gen') codigoGen: string,
        @Body() updateShipment: Partial<Shipments>,
        @CurrentUser() user: any // Usar el decorador CurrentUser
    ): Promise<Shipments> {
        const shipment = await this.shipmentsService.getShipmentByCode(codigoGen);
        
        console.log('Usuario de la sesión en controlador:', user); // Debug log mejorado
        
        /* 
            Datos a modificar por cliente:
 
            Informacion del motorista
            Tranportista
            El peso del ingenio
            Marchamos
        */
        return await this.shipmentsUpdateService.updateShipment(
            shipment.id,
            updateShipment,
            [
                "driver",
                "transporter",
                "productQuantity",
                "unitMeasure",
                "productQuantityKg",
                "shipmentSeals",
                "vehicle"
            ],
            user // Pasar el usuario extraído por el decorador
        );
    }
}