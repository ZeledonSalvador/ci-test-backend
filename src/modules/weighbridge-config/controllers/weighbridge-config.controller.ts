import {
    Controller,
    Post,
    Body,
    UseGuards,
    Get,
    Query,
    Param,
    Patch,
    Delete,
} from '@nestjs/common';
import { WeighbridgeConfigService } from '../services/weighbridge-config.service';
import { CreateSerialComprobanteDto } from '../dto/create-serial-comprobante.dto';
import { UpdateSerialComprobanteDto } from '../dto/update-serial-comprobante.dto';
import { CreateSealSeriesDto } from '../dto/create-seal-series.dto';
import { UpdateSealSeriesDto } from '../dto/update-seal-series.dto';
import { CreateMarchamoDto } from '../dto/create-marchamo.dto';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { AssignComprobanteDto } from '../dto/assign-comprobante.dto';
import { RegistrarImpresionDto } from '../dto/registrar-impresion.dto';
import { AnularMarchamoDto } from '../dto/anular-marchamo.dto';

@UseGuards(AuthGuard)
@Controller('weighbridge')
export class WeighbridgeConfigController {
    constructor(private readonly service: WeighbridgeConfigService) { }

    // ===============================================
    // COMPROBANTES - Series (Correlativos)
    // ===============================================

    /**
     * Crear una nueva serie de comprobantes
     * POST /weighbridge/comprobante/series
     */
    @Post('comprobante/series')
    @Roles(Role.ADMIN, Role.BOT)
    async createSerialComprobante(
        @Body() dto: CreateSerialComprobanteDto,
    ) {
        return this.service.createSerialComprobante(dto);
    }

    /**
     * Listar series de comprobantes con información de uso
     * GET /weighbridge/comprobante/series?id_bascula=1&page=1&limit=10
     */
    @Get('comprobante/series')
    @Roles(Role.ADMIN, Role.BOT)
    async listSerialesConUso(
        @Query('id_bascula') id_bascula?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const currentPage = page ? Number(page) : 1;
        const currentLimit = limit ? Number(limit) : 10;

        return this.service.listSerialesConUso(
            id_bascula ? Number(id_bascula) : undefined,
            currentPage,
            currentLimit,
        );
    }

    /**
     * Actualizar una serie de comprobantes
     * PATCH /weighbridge/comprobante/series/:id
     */
    @Patch('comprobante/series/:id')
    @Roles(Role.ADMIN, Role.BOT)
    async updateSerialComprobante(
        @Param('id') id: string,
        @Body() dto: UpdateSerialComprobanteDto,
    ) {
        return this.service.updateSerialComprobante(Number(id), dto);
    }

    /**
     * Eliminar una serie de comprobantes
     * DELETE /weighbridge/comprobante/series/:id
     */
    @Delete('comprobante/series/:id')
    @Roles(Role.ADMIN, Role.BOT)
    async deleteSerialComprobante(
        @Param('id') id: string,
    ) {
        return this.service.deleteSerialComprobante(Number(id));
    }

    // ===============================================
    // COMPROBANTES - Asignación y gestión
    // ===============================================

    /**
     * Obtener el siguiente comprobante disponible
     * GET /weighbridge/comprobante/next?id_bascula=1
     */
    @Get('comprobante/next')
    @Roles(Role.ADMIN, Role.BOT)
    async getNextComprobante(
        @Query('id_bascula') id_bascula?: string,
    ) {
        const basculaId = id_bascula ? Number(id_bascula) : undefined;
        console.log('[Controller] getNextComprobante - id_bascula recibido:', id_bascula, '-> parseado:', basculaId);
        return this.service.getNextComprobante(basculaId);
    }

    /**
     * Asignar un comprobante a un shipment
     * POST /weighbridge/comprobante/asignar
     */
    @Post('comprobante/asignar')
    @Roles(Role.ADMIN, Role.BOT)
    async assignComprobante(
        @Body() dto: AssignComprobanteDto,
    ) {
        return this.service.assignComprobante(dto);
    }

    /**
     * Listar comprobantes asignados/anulados
     * GET /weighbridge/comprobante/listado?id_bascula=1&status=ASIGNADO&id_comprobseries=5&page=1&limit=10
     */
    @Get('comprobante/listado')
    @Roles(Role.ADMIN, Role.BOT)
    async listComprobantes(
        @Query('id_bascula') id_bascula?: string,
        @Query('status') status?: string,
        @Query('id_comprobseries') id_comprobseries?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const currentPage = page ? Number(page) : 1;
        const currentLimit = limit ? Number(limit) : 10;

        return this.service.listComprobantesAsignadosYAnulados(
            id_bascula ? Number(id_bascula) : undefined,
            status,
            id_comprobseries ? Number(id_comprobseries) : undefined,
            currentPage,
            currentLimit,
        );
    }

    /**
     * Registrar impresión de comprobante
     * POST /weighbridge/comprobante/print
     */
    @Post('comprobante/print')
    @Roles(Role.ADMIN, Role.BOT)
    async registrarImpresion(
        @Body() dto: RegistrarImpresionDto,
    ) {
        return this.service.registrarImpresionComprobante(
            dto.id_shipment,
            new Date(dto.fecha_impresion),
        );
    }

    /**
     * Anular un comprobante por id_shipment
     * PATCH /weighbridge/comprobante/cancel
     */
    @Patch('comprobante/cancel')
    @Roles(Role.ADMIN, Role.BOT)
    async cancelComprobante(
        @Body('id_shipment') id_shipment: number,
        @Body('motivo') motivo?: string,
    ) {
        return this.service.cancelComprobanteByShipmentId(
            id_shipment,
            motivo,
        );
    }

    /**
     * Anular un comprobante por número
     * PATCH /weighbridge/comprobante/cancel-by-number
     */
    @Patch('comprobante/cancel-by-number')
    @Roles(Role.ADMIN, Role.BOT)
    async cancelComprobanteByNumero(
        @Body('no_comprobante') no_comprobante: number,
        @Body('motivo') motivo?: string,
    ) {
        return this.service.cancelComprobanteByNumero(
            no_comprobante,
            motivo,
        );
    }

    // ===============================================
    // MARCHAMOS - Series
    // ===============================================

    /**
     * Crear una nueva serie de marchamos
     * POST /weighbridge/marchamo/series
     */
    @Post('marchamo/series')
    @Roles(Role.ADMIN, Role.BOT)
    async createSealSeries(@Body() dto: CreateSealSeriesDto) {
        return this.service.createSealSeries(dto);
    }

    /**
     * Listar series de marchamos con información de uso
     * GET /weighbridge/marchamo/series?id_bascula=1&ingenio_code=ING001&product_code=AZUCAR&page=1&limit=10
     */
    @Get('marchamo/series')
    @Roles(Role.ADMIN, Role.BOT)
    async listSealSeriesResumen(
        @Query('id_bascula') id_bascula?: string,
        @Query('ingenio_code') ingenio_code?: string,
        @Query('product_code') product_code?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const currentPage = page ? Number(page) : 1;
        const currentLimit = limit ? Number(limit) : 10;

        return this.service.listSealSeriesResumen(
            id_bascula ? Number(id_bascula) : undefined,
            ingenio_code,
            product_code,
            currentPage,
            currentLimit,
        );
    }

    /**
     * Actualizar una serie de marchamos
     * PATCH /weighbridge/marchamo/series/:id
     */
    @Patch('marchamo/series/:id')
    @Roles(Role.ADMIN, Role.BOT)
    async updateSealSeries(
        @Param('id') id: string,
        @Body() dto: UpdateSealSeriesDto,
    ) {
        return this.service.updateSealSeries(Number(id), dto);
    }

    /**
     * Eliminar una serie de marchamos
     * DELETE /weighbridge/marchamo/series/:id
     */
    @Delete('marchamo/series/:id')
    @Roles(Role.ADMIN, Role.BOT)
    async deleteSealSeries(
        @Param('id') id: string,
    ) {
        return this.service.deleteSealSeries(Number(id));
    }

    // ===============================================
    // MARCHAMOS - Asignación y gestión
    // ===============================================

    /**
     * Crear/asignar marchamos a un shipment
     * POST /weighbridge/marchamo/asignar
     */
    @Post('marchamo/asignar')
    @Roles(Role.ADMIN, Role.BOT)
    async createMarchamo(@Body() dto: CreateMarchamoDto) {
        return this.service.createMarchamo(dto);
    }

    /**
     * Listar marchamos
     * GET /weighbridge/marchamo/listado?id_shipment=123&id_sealseries=10&page=1&limit=10
     */
    @Get('marchamo/listado')
    @Roles(Role.ADMIN, Role.BOT)
    async listMarchamos(
        @Query('id_shipment') idShipment?: string,
        @Query('id_sealseries') idSealSeries?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const currentPage = page ? Number(page) : 1;
        const currentLimit = limit ? Number(limit) : 10;

        return this.service.listMarchamosPorShipment(
            idShipment ? Number(idShipment) : undefined,
            idSealSeries ? Number(idSealSeries) : undefined,
            currentPage,
            currentLimit,
        );
    }

    /**
     * Anular un marchamo por código
     * PATCH /weighbridge/marchamo/cancel
     */
    @Patch('marchamo/cancel')
    @Roles(Role.ADMIN, Role.BOT)
    async anularMarchamo(
        @Body() dto: AnularMarchamoDto,
    ) {
        return this.service.anularMarchamoPorCodigo(dto);
    }

    /**
     * Anular todos los marchamos de un shipment
     * PATCH /weighbridge/marchamo/cancel-by-shipment
     */
    @Patch('marchamo/cancel-by-shipment')
    @Roles(Role.ADMIN, Role.BOT)
    async anularMarchamosPorShipment(
        @Body('id_shipment') id_shipment: number,
        @Body('motivo') motivo?: string,
    ) {
        return this.service.anularMarchamosPorShipment(id_shipment, motivo);
    }

}
