import { IsDateString, IsOptional } from 'class-validator';

/**
 * Filtros opcionales para el Reporte de Temperatura.
 * - from/to: filtra por created_at de ShipmentsTemperature
 */
export class TemperatureReportFilterDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
