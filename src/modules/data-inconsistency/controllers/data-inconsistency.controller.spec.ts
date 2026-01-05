import { 
    Controller, 
    Post, 
    Get, 
    Body, 
    Param, 
    Query, 
    UseGuards,
    Res,
    BadRequestException
} from '@nestjs/common';
import { Response } from 'express';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { DataInconsistencyService } from '../services/data-inconsistency.service';
import { ReportInconsistencyDto, GetInconsistenciesQueryDto } from '../dto/inconsistency-report.dto';
import { InconsistencyResponseDto } from '../dto/inconsistency-response.dto';
import { PaginationInfo } from 'src/dto/pagination';

@Controller('data-inconsistency')
@UseGuards(AuthGuard)
export class DataInconsistencyController {

    constructor(
        private readonly dataInconsistencyService: DataInconsistencyService
    ) { }

    @Post('report')
    @Roles(Role.ADMIN, Role.BOT)
    async reportInconsistency(@Body() reportData: ReportInconsistencyDto): Promise<InconsistencyResponseDto> {
        console.log('La peticion fue hecha por un rol ', [Role.ADMIN, Role.BOT]);
        console.log('Reportando inconsistencia para envío: ', reportData.codeGen);
        
        return await this.dataInconsistencyService.reportInconsistency(reportData);
    }

    @Get('shipment/:codeGen')
    @Roles(Role.ADMIN, Role.BOT)
    async getInconsistencyByShipment(
        @Param('codeGen') codeGen: string
    ): Promise<InconsistencyResponseDto | { message: string; codeGen: string; statusCode: number }> {
        console.log('Buscando inconsistencias para envío: ', codeGen);
        
        return await this.dataInconsistencyService.getInconsistencyByShipment(codeGen);
    }

    @Get()
    @Roles(Role.ADMIN, Role.BOT)
    async getAllInconsistencies(
        @Query() query: GetInconsistenciesQueryDto,
        @Res() res: Response
    ): Promise<void> {
        const page = query.page || 1;
        const size = query.size || 20;

        if (page < 1 || size < 1) {
            throw new BadRequestException('Los parámetros page y size deben ser números positivos');
        }

        // Validar formato de fechas solo si se proporcionan
        if (query.startDate || query.endDate) {
            if (query.startDate && query.endDate) {
                const start = new Date(`${query.startDate}T00:00:00`);
                const end = new Date(`${query.endDate}T23:59:59`);

                if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    throw new BadRequestException('Las fechas deben tener un formato válido (YYYY-MM-DD)');
                }
            } else {
                throw new BadRequestException('Si proporciona fechas, tanto startDate como endDate son requeridos');
            }
        }

        console.log(`Obteniendo inconsistencias - Página: ${page}, Tamaño: ${size}${query.startDate ? `, Fechas: ${query.startDate} - ${query.endDate}` : ''}`);
        
        const { data, pagination } = await this.dataInconsistencyService.getAllInconsistencies(page, size, query);

        res.set(new PaginationInfo(pagination).headers);
        res.status(200).json(data);
    }

    @Get('seals/:shipmentId')
    @Roles(Role.ADMIN, Role.BOT)
    async getSealsByShipment(@Param('shipmentId') shipmentId: number) {
        console.log('Obteniendo seals para shipment ID: ', shipmentId);
        
        return await this.dataInconsistencyService.getSealsByShipment(shipmentId);
    }
}