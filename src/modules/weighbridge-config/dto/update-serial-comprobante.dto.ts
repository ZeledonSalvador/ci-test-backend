// src/modules/weighbridge-config/dto/update-serial-comprobante.dto.ts
import { IsInt, Min, IsOptional } from 'class-validator';

export class UpdateSerialComprobanteDto {
  @IsOptional()
  @IsInt()
  min_serialnumber?: number;

  @IsOptional()
  @IsInt()
  max_serialnumber?: number;

  @IsOptional()
  @IsInt()
  numero_caja?: number;
}
