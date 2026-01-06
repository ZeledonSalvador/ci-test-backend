import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { ShipmentsQueryService } from '../services/shipments-query.service';

@Controller('shipping/query')
@UseGuards(AuthGuard)
export class ShipmentsQueryController {
  constructor(private readonly shipmentsQueryService: ShipmentsQueryService) {}

  /**
   * Obtiene envíos por estado con filtros adicionales
   * Incluye fecha de llegada a status 5
   *
   * GET /api/shipping/query/status/:type
   *
   * Query params:
   * - startDate: fecha inicio (opcional)
   * - endDate: fecha fin (opcional)
   * - page: número de página (default: 1)
   * - size: tamaño de página (default: 30)
   * - activity: número de actividad (opcional)
   * - product: tipo de producto (opcional)
   */
  @Get('status/:type')
  @Roles(Role.ADMIN, Role.BOT)
  async getShipmentsByStatusWithFilters(
    @Param('type') statusType: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('activity') activity?: string,
    @Query('product') product?: string,
  ) {
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(size, 10) || 30;

    return await this.shipmentsQueryService.getShipmentsByStatusWithFilters(
      statusType,
      startDate,
      endDate,
      pageNumber,
      pageSize,
      activity,
      product,
    );
  }

  /**
   * Obtiene todos los filtros disponibles (productos y actividades)
   *
   * GET /api/shipping/query/filters
   */
  @Get('filters')
  @Roles(Role.ADMIN, Role.BOT)
  async getAvailableFilters(): Promise<{
    products: { code: string; name: string }[];
    activities: { code: string; name: string }[];
  }> {
    return this.shipmentsQueryService.getAvailableFilters();
  }
}
