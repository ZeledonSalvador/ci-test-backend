import { 
    Controller, 
    Post, 
    Body, 
    Get, 
    Put,
    UseGuards, 
    Query, 
    Res, 
    Param, 
    UseInterceptors,
    UploadedFiles,
    BadRequestException,
    ParseIntPipe,
    Header
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { BlacklistService } from '../services/blacklist.service';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { SkipClientValidation } from 'src/modules/auth/decorators/skipClientValidation.decorator';
import { PaginationInfo } from 'src/dto/pagination';
import type { Express, Response } from 'express';
import { CreateReportDto } from '../dto/CreateReportDto';
import { CreatePenaltyDto } from '../dto/CreatePenaltyDto';
import { UpdatePenaltyDto } from '../dto/UpdatePenaltyDto';
import { BlacklistReportResponseDto } from '../dto/BlacklistReportResponseDto';
import { BlacklistDetailsResponseDto } from '../dto/BlacklistDetailsResponseDto';
import { PenaltyType } from '../enums/PenaltyType.enum';
import { memoryStorage } from 'multer';

@Controller('blacklist')
@UseGuards(AuthGuard)
export class BlacklistController {
    constructor(private readonly blacklistService: BlacklistService) { }

    // === ENDPOINTS PARA REPORTES DE INCIDENTES (Status 1) ===

    /**
     * Crear un nuevo reporte de incidente (Status 1)
     * POST /blacklist/reports
     */
    @Post('reports')
    @Roles(Role.ADMIN, Role.BOT)
    @UseInterceptors(
        AnyFilesInterceptor({
        storage: memoryStorage(),             // usar memoria, no disco
        limits: {
            fileSize: 20 * 1024 * 1024,        // 20 MB por archivo
            files: 10                          // máx 10 archivos
        }
        })
    )

    @Header('Connection', 'close')           // mitiga proxies que truncan respuesta
    async createReport(
        @Body() createReportDto: CreateReportDto,
        @UploadedFiles() allFiles: Express.Multer.File[] | undefined,
    ): Promise<BlacklistReportResponseDto> {
        try {
            const evidenceFiles = allFiles?.filter(file => 
                file.fieldname === 'evidenceFiles'
            );
            
            return await this.blacklistService.createReport(createReportDto, evidenceFiles);
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error; // Re-throw validation errors
            }
            throw new BadRequestException('Error procesando el reporte');
        }
    }

    /**
     * Obtener reportes pendientes de decisión gerencial (Status 1)
     * GET /blacklist/reports/pending?includeAttachments=true
     */
    @Get('reports/pending')
    @Roles(Role.ADMIN, Role.BOT)
    @SkipClientValidation()
    async getPendingReports(
        @Res() res: Response,
        @Query('page') page: string = '1',
        @Query('size') size: string = '10',
        @Query('license') license?: string,
        @Query('eventType') eventType?: string,
        @Query('shipmentId') shipmentId?: string,
        @Query('includeAttachments') includeAttachments?: string,
        @Query('search') search?: string,
    ): Promise<void> {
        const pageNumber = Number(page) || 1;
        const sizeNumber = Number(size) || 10;
        const shipmentIdNumber = shipmentId ? Number(shipmentId) : undefined;
        const includeAttachmentsBool = includeAttachments?.toLowerCase() === 'true';

        const { data, pagination } = await this.blacklistService.getPendingReports(
            pageNumber, 
            sizeNumber, 
            license, 
            eventType,
            shipmentIdNumber,
            includeAttachmentsBool,
            search
        );

        res.set(new PaginationInfo(pagination).headers);
        res.status(200).json(data);
    }

    // === ENDPOINTS PARA DECISIONES GERENCIALES ===

    /**
     * Aplicar decisión gerencial sobre un reporte (Status 1 → Status 2 o 3)
     * Tipos: NO_APLICADO, TEMPORAL, PERMANENTE
     * POST /blacklist/reports/apply-penalty
     */
    @Post('reports/apply-penalty')
    @Roles(Role.ADMIN, Role.BOT)
    async applyManagerDecision(
        @Body() createPenaltyDto: CreatePenaltyDto
    ): Promise<BlacklistReportResponseDto> {
        return this.blacklistService.applyManagerDecision(createPenaltyDto);
    }

    // === ENDPOINTS PARA AMONESTACIONES ACTIVAS (Status 2) ===

    /**
     * Modificar amonestación activa (Status 2)
     * Se puede cambiar a TEMPORAL, PERMANENTE o FINALIZADO
     * PUT /blacklist/reports/active/:id
     */
    @Put('reports/active/:id')
    @Roles(Role.ADMIN, Role.BOT)
    async updateActivePenalty(
        @Param('id', ParseIntPipe) penaltyId: number,
        @Body() updatePenaltyDto: UpdatePenaltyDto
    ): Promise<BlacklistReportResponseDto> {
        return this.blacklistService.updateActivePenalty(penaltyId, updatePenaltyDto);
    }

    /**
     * Obtener amonestaciones activas (Status 2)
     * GET /blacklist/reports/active?includeAttachments=true
     */
    @Get('reports/active')
    @Roles(Role.ADMIN, Role.BOT)
    @SkipClientValidation()
    async getActivePenalties(
        @Res() res: Response,
        @Query('page') page: string = '1',
        @Query('size') size: string = '10',
        @Query('license') license?: string,
        @Query('penaltyType') penaltyType?: PenaltyType,
        @Query('isActive') isActive?: string,
        @Query('includeAttachments') includeAttachments?: string,
        @Query('search') search?: string,
    ): Promise<void> {
        const pageNumber = Number(page) || 1;
        const sizeNumber = Number(size) || 10;
        const isActiveBool = isActive ? isActive.toLowerCase() === 'true' : undefined;
        const includeAttachmentsBool = includeAttachments?.toLowerCase() === 'true';

        const { data, pagination } = await this.blacklistService.getActivePenalties(
            pageNumber, 
            sizeNumber, 
            license, 
            penaltyType,
            isActiveBool,
            includeAttachmentsBool,
            search
        );

        res.set(new PaginationInfo(pagination).headers);
        res.status(200).json(data);
    }

    // === ENDPOINTS PARA LIBERACIONES (Status 3) ===

    /**
     * Obtener conductores liberados (Status 3)
     * Incluye NO_APLICADO y FINALIZADO
     * GET /blacklist/liberated?liberationType=NO_APLICADO&includeAttachments=true
     */
    @Get('liberated')
    @Roles(Role.ADMIN, Role.BOT)
    @SkipClientValidation()
    async getLiberatedDrivers(
        @Res() res: Response,
        @Query('page') page: string = '1',
        @Query('size') size: string = '10',
        @Query('license') license?: string,
        @Query('liberationType') liberationType?: 'NO_APLICADO' | 'FINALIZADO',
        @Query('includeAttachments') includeAttachments?: string,
    ): Promise<void> {
        const pageNumber = Number(page) || 1;
        const sizeNumber = Number(size) || 10;
        const includeAttachmentsBool = includeAttachments?.toLowerCase() === 'true';

        const { data, pagination } = await this.blacklistService.getLiberatedDrivers(
            pageNumber, 
            sizeNumber, 
            license, 
            liberationType,
            includeAttachmentsBool
        );

        res.set(new PaginationInfo(pagination).headers);
        res.status(200).json(data);
    }

    // === ENDPOINTS DE CONSULTA GENERAL ===

    /**
     * Obtener todos los registros con filtros
     * GET /blacklist/records?includeAttachments=true
     */
    @Get('records')
    @Roles(Role.ADMIN, Role.BOT)
    @SkipClientValidation()
    async getAllRecords(
        @Res() res: Response,
        @Query('page') page: string = '1',
        @Query('size') size: string = '10',
        @Query('license') license?: string,
        @Query('eventType') eventType?: string,
        @Query('statusBlacklist') statusBlacklist?: string,
        @Query('shipmentId') shipmentId?: string,
        @Query('clientId') clientId?: string,
        @Query('includeAttachments') includeAttachments?: string,
    ): Promise<void> {
        const pageNumber = Number(page) || 1;
        const sizeNumber = Number(size) || 10;
        const statusNumber = statusBlacklist ? Number(statusBlacklist) : undefined;
        const shipmentIdNumber = shipmentId ? Number(shipmentId) : undefined;
        const clientIdNumber = clientId ? Number(clientId) : undefined;
        const includeAttachmentsBool = includeAttachments?.toLowerCase() === 'true';

        const { data, pagination } = await this.blacklistService.getAllRecords(
            pageNumber, 
            sizeNumber, 
            license, 
            eventType, 
            statusNumber,
            shipmentIdNumber,
            clientIdNumber,
            includeAttachmentsBool
        );

        res.set(new PaginationInfo(pagination).headers);
        res.status(200).json(data);
    }

    /**
     * Obtener registro específico por ID
     * GET /blacklist/records/:id?includeAttachments=true
     */
    @Get('records/:id')
    @Roles(Role.ADMIN, Role.BOT)
    @SkipClientValidation()
    async getRecordById(
        @Param('id', ParseIntPipe) id: number,
        @Query('includeAttachments') includeAttachments?: string,
    ): Promise<BlacklistReportResponseDto> {
        const includeAttachmentsBool = includeAttachments?.toLowerCase() === 'true';
        return await this.blacklistService.getRecordById(id, includeAttachmentsBool);
    }

    /**
     * Obtener registros por shipment
     * GET /blacklist/shipments/:shipmentId?includeAttachments=true
     */
    @Get('shipments/:shipmentId')
    @Roles(Role.ADMIN, Role.BOT)
    @SkipClientValidation()
    async getRecordsByShipment(
        @Param('shipmentId', ParseIntPipe) shipmentId: number,
        @Query('includeAttachments') includeAttachments?: string,
    ): Promise<BlacklistReportResponseDto[]> {
        const includeAttachmentsBool = includeAttachments?.toLowerCase() === 'true';
        return await this.blacklistService.getRecordsByShipment(shipmentId, includeAttachmentsBool);
    }

    /**
     * Obtener registros por cliente
     * GET /blacklist/clients/:clientId?includeAttachments=true
     */
    @Get('clients/:clientId')
    @Roles(Role.ADMIN, Role.BOT)
    @SkipClientValidation()
    async getRecordsByClient(
        @Res() res: Response,
        @Param('clientId', ParseIntPipe) clientId: number,
        @Query('page') page: string = '1',
        @Query('size') size: string = '10',
        @Query('includeAttachments') includeAttachments?: string,
    ): Promise<void> {
        const pageNumber = Number(page) || 1;
        const sizeNumber = Number(size) || 10;
        const includeAttachmentsBool = includeAttachments?.toLowerCase() === 'true';

        const { data, pagination } = await this.blacklistService.getRecordsByClient(
            clientId,
            pageNumber,
            sizeNumber,
            includeAttachmentsBool
        );

        res.set(new PaginationInfo(pagination).headers);
        res.status(200).json(data);
    }

    /**
     * Obtener detalles del conductor (solo amonestaciones activas Status 2)
     * GET /blacklist/drivers/:license/details
     */
    @Get('drivers/:license/details')
    @Roles(Role.ADMIN, Role.BOT)
    @SkipClientValidation()
    async getDriverDetails(
        @Param('license') license: string
    ): Promise<BlacklistDetailsResponseDto> {
        return await this.blacklistService.getBlacklistDetails(license);
    }
}