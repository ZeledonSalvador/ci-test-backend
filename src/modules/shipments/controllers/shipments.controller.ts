import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    Query,
    UseGuards,
    Put,
    BadRequestException,
    Res
} from '@nestjs/common';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { CreateShipmentDto } from '../dto/shipmentRequest.dto';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { ShipmentsService } from '../services/shipments.service';
import { Shipments } from 'src/models/Shipments';
import { UpdateShipmentDto } from '../dto/updateShiment.dto';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { UploadFileAttachementShipmentDto } from '../dto/shipmentsAttachement.dto';
import { ShipmentAttachments } from 'src/models/ShipmentAttachments';
import { GetAttachmentsQueryDto } from '../dto/getAttachmentsQuery.dto';
import ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse from '../interfaces/ShipmentsWithFormattedStatusesAndFormatResponse.interface';
import DocumentToShipmentMapper from '../mapper/DocumentoToShipmentMapper';
import { ApendiceCoderRequest } from '../dto/ApendiceCoderRequest.dto';
import CSVEncoderApendice from '../mapper/CSVSerializerApendice';
import { ApendiceDTO, DocumentoDTO } from '../mapper/dte.dto';
import { BlacklistDetailsResponseDto } from 'src/modules/blacklist/dto/BlacklistDetailsResponseDto';
import { Response } from 'express';
import { PaginationInfo } from 'src/dto/pagination';
import { ShipmentsUpdateService } from '../services/shipments-update.service';
import { AsignarBuzzerDto } from '../dto/asignar-buzzer.dto';
import { RegistrarTemperaturaDto } from '../dto/registrar-temperatura.dto';
import { UsePipes, ValidationPipe } from '@nestjs/common';
import { ShipmentTimesFilterDto } from 'src/modules/shipments/dto/shipment-times.dto';
import { BrixEligibleQueryDto } from '../dto/brix-query.dto';
import { AssignBrixDto } from '../dto/assign-brix.dto';
import { RegistrarPesosDto } from '../dto/registrar-pesos.dto';
import { RegistrarHumedadDto } from '../dto/registrar-humedad.dto';
import { TemperatureReportFilterDto } from 'src/modules/shipments/dto/temperature-report.dto';


@Controller('shipping')
@UseGuards(AuthGuard)
export class ShippingController {
    constructor(
        private readonly shipmentsService: ShipmentsService,
        private readonly shipmentsUpdateService: ShipmentsUpdateService
    ) { }

    @Post()
    @Roles(Role.ADMIN, Role.CLIENT)
    async createShipment(
        @Body() createShipmentDto: CreateShipmentDto,
        @CurrentUser() user: any
    ): Promise<{ shipment?: Shipments; } | BlacklistDetailsResponseDto> {
        return this.shipmentsService.createShipment(createShipmentDto, false, user);
    }

    @Post('/load-nr')
    @Roles(Role.ADMIN, Role.CLIENT)
    async loadMapDte(
        @Body() requestBody: any,
        @CurrentUser() user: any
    ): Promise<{ shipment?: Shipments; } | BlacklistDetailsResponseDto> {
        const mapper = new DocumentToShipmentMapper(
            JSON.stringify(requestBody),
            this.shipmentsService.getTruckTypeVehicleByPlateAndTrailerPlate.bind(this.shipmentsService),
            this.shipmentsService['ingenioLogsService'], // Acceso al servicio de logs
            user // Usuario para los logs
        );

        const notaremisionbuiled = await mapper.build();
        return notaremisionbuiled?.logs?.allFieldsComplete === false
            ? notaremisionbuiled
            : this.shipmentsService.createShipment(notaremisionbuiled, true, user);
    }

    @Put(':codigo_gen')
    @Roles(Role.ADMIN)
    async updateShipment(
        @Param('codigo_gen') codigoGen: string,
        @Body() updateShipment: Partial<Shipments>
    ): Promise<Shipments> {

        const shipment = await this.shipmentsService.getShipmentByCode(codigoGen);

        return await this.shipmentsUpdateService.updateShipment(
            shipment.id,
            updateShipment
        );
        /* return this.shipmentsService.updateShipmentByCodeGen(codigoGen, updateShipmentDto); */
    }

    @Get('report')
    async getReport(@Res() res: Response, @Query() filter: ShipmentTimesFilterDto) {
        if (filter.format) {
            const file = await this.shipmentsService.getReportFile(filter);
            res.setHeader('Content-Type', file.mime);
            res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
            return res.send(file.buffer);
        }
        return res.json(await this.shipmentsService.getReport(filter));
    }

    @Get('temperature-report')
        @Roles(Role.ADMIN, Role.BOT)
        async getTemperatureReport(@Query() filter: TemperatureReportFilterDto) {
        return this.shipmentsService.getTemperatureReport(filter);
        }

    
    @Get('requires-sweeping-report')
        @Roles(Role.ADMIN, Role.BOT)
        async getRequiresSweepingReport() {
        return this.shipmentsService.getRequiresSweepingReport();
        }



    @Get(':code_gen')
    @Roles(Role.ADMIN, Role.BOT)
    async getShipmentByCode(
        @Param('code_gen') codeGen: string,
        @Query('includeAttachments') includeAttachments: string
    ): Promise<ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse> {
        return this.shipmentsService.getShipmentByCode(
            codeGen,
            includeAttachments === 'true'
        );
    }

    @Get('ingenio/:codigo_ingenio')
    @Roles(Role.ADMIN)
    async getShipmentsByIngenio(
        @Param('codigo_ingenio') codigoIngenio: string,
        @Res() res: Response,
        @Query('page') page?: number,
        @Query('size') size?: number,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ): Promise<void> {
        const defaultPage = 1;
        const defaultSize = 10;
        const currentPage = isNaN(page) ? defaultPage : page;
        const currentSize = isNaN(size) ? defaultSize : size;
        const start = startDate ? new Date(`${startDate}T00:00:00`) : undefined;
        const end = endDate ? new Date(`${endDate}T23:59:59`) : undefined;

        const { data, pagination } = await this.shipmentsService.getShipmentsByIngenio(
            codigoIngenio, currentPage, currentSize, start, end
        );
        res.set(new PaginationInfo(pagination).headers);
        res.status(200).json(data);
    }


    @Get()
    @Roles(Role.ADMIN, Role.BOT)
    async getAllShipments(
        @Res() res: Response,
        @Query('page') page: string,
        @Query('size') size: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('search') search?: string,
        @Query('nameProduct') nameProduct?: string,
        @Query('truckType') truckType?: string,
        @Query('excludeStatus') excludeStatus?: string,
        @Query('includeAttachments') includeAttachments?: string,
        @Query('includeStatuses') includeStatuses?: string,
    ): Promise<void> {
        console.log(`[ShippingController.getAllShipments] Parámetros:`, {
            page, size, startDate, endDate, search, nameProduct, truckType, excludeStatus,
            includeAttachments, includeStatuses
        });

        const pageNumber = Number(page) || 1;
        const sizeNumber = Number(size) || 10;
        const includeAttachmentsBoolean = includeAttachments === 'true';
        const includeStatusesBoolean = includeStatuses === 'true';

        try {
            const startTime = Date.now();

            const { data, pagination } = await this.shipmentsService.getAllShipments(
                pageNumber,
                sizeNumber,
                startDate,
                endDate,
                search,
                nameProduct,
                truckType,
                excludeStatus,
                includeAttachmentsBoolean,
                includeStatusesBoolean
            );

            const endTime = Date.now();
            const duration = endTime - startTime;

            res.set(new PaginationInfo(pagination).headers);
            res.set({
                'X-Query-Duration': `${duration}ms`,
                'X-Include-Statuses': includeStatusesBoolean.toString(),
                'X-Include-Attachments': includeAttachmentsBoolean.toString()
            });

            console.log(`[ShippingController.getAllShipments] Respuesta: ${data.length} registros en ${duration}ms`);

            res.status(200).json(data);

        } catch (error) {
            console.error(`[ShippingController.getAllShipments] Error:`, error.message);
            res.status(500).json({
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString(),
                path: '/api/shipping'
            });
        }
    }

    @Get('status/:type')
    @Roles(Role.ADMIN, Role.BOT)
    async getShipmentsByStatus(
        @Param('type') statusType: number,
        @Res() res: Response,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('includeAttachments') includeAttachments?: string,
        @Query('page') page?: string,
        @Query('size') size?: string,
        @Query('reportType') reportType?: 'PRECHECK' | 'SEALS'
    ): Promise<void> {
        const includeAttachmentsBoolean = includeAttachments === 'true';
        const pageNumber = parseInt(page, 10) || 1;
        const pageSize = parseInt(size, 10) || 30;

        const { data, pagination } = await this.shipmentsService.getShipmentsByStatus(
            statusType,
            startDate,
            endDate,
            includeAttachmentsBoolean,
            pageNumber,
            pageSize,
            false,
            reportType
        );
        res.set(new PaginationInfo(pagination).headers);
        res.status(200).json(data);
    }




    @Post('upload')
    @Roles(Role.ADMIN, Role.BOT)
    async uploadFile(@Body() uploadFileDto: UploadFileAttachementShipmentDto) {
        console.log("Llegue a upload");
        return this.shipmentsService.uploadFile(
            uploadFileDto.urlfileOrbase64file,
            uploadFileDto.type,
            uploadFileDto.isBase64,
            uploadFileDto.codeGen,
        );
    }


    @Get(':codeGen/attachments')
    @Roles(Role.ADMIN, Role.BOT)
    async getAttachmentsByCodeGen(
        @Param('codeGen') codeGen: string,
        @Query() query: GetAttachmentsQueryDto
    ): Promise<ShipmentAttachments[]> {
        console.log("Llegue a attachements");
        return this.shipmentsService.getAttachmentsByCodeGen(codeGen, query.type);
    }


    @Post('/encode-apendice')
    encodeJson(@Body() input: ApendiceCoderRequest): ApendiceDTO[] {
        if (!input) {
            throw new BadRequestException("El input no debe de estar vacio.");
        }
        const createApendice = (label: string, valores: { [key: string]: string | string[] }): ApendiceDTO => {
            const encoded = new CSVEncoderApendice(label, valores).toJSON();
            return {
                campo: encoded.campo,
                etiqueta: encoded.etiqueta,
                valor: encoded.valor
            };
        };
        return [
            createApendice("main", input.main),
            createApendice("others", input.others)
        ];
    }


    @Post('/decode-apendice')
    decodeApendiceJson(@Body() input: ApendiceDTO[]): { [key: string]: string | string[] } {
        if (!input) {
            throw new BadRequestException("El input no debe de estar vacio.");
        }
        return CSVEncoderApendice.buildApendice(input);

    }



    @Post('/decode-nota-remision')
    async decodeNotaRemision(@Body() requestBody: any): Promise<CreateShipmentDto> {
        const mapper = new DocumentToShipmentMapper(
            JSON.stringify(requestBody),
            this.shipmentsService.getTruckTypeVehicleByPlateAndTrailerPlate.bind(this.shipmentsService)
        );

        const notaremisionbuiled = await mapper.build();
        return notaremisionbuiled;

    }


    /* 
        TODO: Este endpoint es puramente
        para debug asi que tiene que quitarse!!!
    */
    /*  @Get('/all/:codeGen')
        getAll(
            @Param('codeGen') codeGen: string
        ) {
            return this.shipmentsService.findAllRecordByCodeGen(codeGen);
        } 
    */

    @Post('/setMagneticCard')
    @Roles(Role.ADMIN, Role.BOT)
    async setMagneticCard(
        @Body('codeGen') codeGen: string,
        @Body('cardNumber') cardNumber: number
    ) {
        console.log("Llegue a magneticcard");
        return await this.shipmentsService.setMagneticCard(codeGen, cardNumber);
    }

    @Post('/sugartime')
    @Roles(Role.ADMIN, Role.BOT)
    async setSugarTimes(
        @Body('codeGen') codeGen: string,
        @Body('time') time: string,
        @Body('observation') observation: string
    ) {
        console.log("Llegue a sugartime");
        return await this.shipmentsService.setSugarTime(
            codeGen, time, observation
        );
    }

    @Get('/sugartime/:codeGen')
    @Roles(Role.ADMIN, Role.BOT)
    async getSugarTimes(
        @Param('codeGen') codeGen: string
    ) {
        console.log("Llegue a sugartime code_gen");
        return await this.shipmentsService.getSugarTime(codeGen);
    }

    @Post('/sweepinglog')
    @Roles(Role.ADMIN, Role.BOT)
    async setSweepingLog(
        @Body('codeGen') codeGen: string,
        @Body('requiresSweeping') requiresSweeping: string,
        @Body('observation') observation: string
    ) {
        console.log("Llegue a sweepinglog");
        return await this.shipmentsService.setSweepingLog(
            codeGen,
            requiresSweeping.toLocaleLowerCase() == "true",
            observation
        );
    }


    @Get('/sweepinglog/:codeGen')
    @Roles(Role.ADMIN, Role.BOT)
    async getSweepingLog(
        @Param('codeGen') codeGen: string
    ) {
        console.log("Llegue a sweepinglog code_gen");
        return await this.shipmentsService.getSweepingLog(codeGen);
    }

    @Put('buzzers/asignar/:code_gen')
    @UsePipes(new ValidationPipe({ whitelist: true }))
    @Roles(Role.ADMIN, Role.BOT)
    async asignarBuzzer(
        @Param('code_gen') rawCodeGen: string,
        @Body() body: AsignarBuzzerDto
    ) {
        console.log('🔔 Llegue a asignarBuzzer');

        // 🔧 Limpiar cualquier comilla simple que venga en el code_gen
        const codeGen = rawCodeGen.replace(/'/g, '');

        console.log(`[INFO] Intentando asignar buzzer ${body.buzzer} al envío ${codeGen}`);

        const shipment = await this.shipmentsService.getShipmentByCode(codeGen);


        return this.shipmentsService.asignarBuzzer(shipment.id, body.buzzer);
    }


    @Get('/ranking/motoristas')
    @Roles(Role.ADMIN, Role.BOT)
    async getRankingMotoristas(
        @Query('license') license: string
    ) {
        if (!license) {
            throw new BadRequestException('Se requiere el parámetro license');
        }
        console.log("Llegue a motoristas");
        return this.shipmentsService.getDriverStatsByLicense(license);
    }

    @Post('temperatura/:codeGen')
    @Roles(Role.ADMIN, Role.BOT)
    async registrarTemperatura(
        @Param('codeGen') codeGen: string,
        @Body() body: RegistrarTemperaturaDto,
    ) {
        // Validación simple
        const t = Number(body?.temperature);
        if (body?.temperature == null || Number.isNaN(t)) {
            throw new BadRequestException({
                message: 'temperature es requerido y debe ser numérico.',
                sent: { codeGen, temperature: body?.temperature, idNavRecord: null },
            });
        }

        // Llama al servicio
        const data = await this.shipmentsService.registrarTemperatura(codeGen, t);

        // Tolerante a snake/camel en la respuesta del servicio
        const idNavRecord = (data as any).id_nav_record ?? (data as any).idNavRecord ?? null;

        return {
            success: true,
            message: 'Temperatura registrada correctamente.',
            sent: { codeGen, temperature: t, idNavRecord },
            data, // { shipmentId, codeGen, id_nav_record (o idNavRecord), id, temperature, createdAt }
        };
    }


    @Get('brix/view')
    @Roles(Role.ADMIN, Role.BOT)
    getBrixEligible(@Query() query: BrixEligibleQueryDto) {
        return this.shipmentsService.findBrixEligible(query);
    }

    @Post('brix')
    @Roles(Role.ADMIN, Role.BOT)
    assignBrix(@Body() dto: AssignBrixDto) {
        return this.shipmentsService.assignBrix(dto);
    }

    @Get('/dashboard/transactions-stats')
    @Roles(Role.ADMIN, Role.BOT)
    async getDailyTransactionsStats(
        @Query('customerId') customerId?: string,
        @Query('productId') productId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.shipmentsService.getDailyTransactionsStats(
            customerId,
            productId,
            startDate,
            endDate
        );
    }

    @Get('/dashboard/detailed-report')
    @Roles(Role.ADMIN, Role.BOT)
    async getDetailedShipmentReport(
        @Query('productId') productId?: string,
        @Query('transactionStatus') transactionStatus?: number,
        @Query('customerId') customerId?: string,
        @Query('pageNumber') pageNumber?: string,
        @Query('pageSize') pageSize?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        // Convertir parámetros a números
        const pageNum = pageNumber ? parseInt(pageNumber, 10) : 1;
        const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;

        return this.shipmentsService.getDetailedShipmentReport(
            productId,
            transactionStatus,
            customerId,
            pageNum,
            pageSizeNum,
            startDate,
            endDate
        );
    }

    @Get('/dashboard/transactions')
    @Roles(Role.ADMIN, Role.BOT)
    async getTransactionsByDateRange(
        @Query('customerId') customerId?: string,
        @Query('productId') productId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.shipmentsService.getTransactionsByDateRange(
            customerId,
            productId,
            startDate,
            endDate
        );
    }

    @Post('peso/:codeGen')
    @Roles(Role.ADMIN, Role.BOT)   // o los roles que uses
    async registrarPesos(
        @Param('codeGen') codeGen: string,
        @Body() body: RegistrarPesosDto,
    ) {
        const navStatus = Number(body?.navStatus);
        if (body?.navStatus == null || Number.isNaN(navStatus)) {
            throw new BadRequestException({
                message: 'navStatus es requerido y debe ser numérico.',
                sent: { codeGen, navStatus: body?.navStatus },
            });
        }

        const data = await this.shipmentsService.registrarPesos(codeGen, navStatus);

        return {
            success: true,
            message: data?.message ?? 'Pesos registrados correctamente.',
            data,
        };
    }

    // Endpoint para guardar la humedad
    @Post('humidity/:codeGen')
    @Roles(Role.ADMIN, Role.BOT) // o los roles que uses
    async registrarHumedad(
        @Param('codeGen') codeGen: string,
        @Body() body: RegistrarHumedadDto,
    ) {
        const humidity = Number(body?.humidity);

        if (body?.humidity == null || Number.isNaN(humidity)) {
            throw new BadRequestException({
                message: 'humidity es requerido y debe ser numérico.',
                sent: { codeGen, humidity: body?.humidity },
            });
        }

        const result = await this.shipmentsService.registrarHumedad(
            codeGen,
            humidity,
        );

        return {
            success: true,
            message: 'Humedad registrada correctamente.',
            shipmentId: result.shipmentId,
            codeGen: result.codeGen,
            humidity: result.humidity,
        };
    }

    @Post('location/:codeGen')
    @Roles(Role.ADMIN, Role.BOT)
    async registrarLocation(
        @Param('codeGen') codeGen: string,
        @Body('code') code: string,
    ) {
        const trimmed = code?.trim();

        if (!trimmed) {
            throw new BadRequestException({
                message: 'code es requerido.',
                sent: { codeGen, code },
            });
        }

        const result = await this.shipmentsService.registrarLocation(codeGen, trimmed);

        return {
            success: true,
            message: 'Location registrada correctamente.',
            shipmentId: result.shipmentId,
            codeGen: result.codeGen,
            locationCode: result.locationCode,
        };
    }
}