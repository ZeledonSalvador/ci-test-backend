// src/modules/weighbridge-config/dto/create-serial-comprobante.dto.ts
import { IsInt, Min, IsOptional } from 'class-validator';

export class CreateSerialComprobanteDto {
  @IsInt()
  @Min(1)
  id_bascula: number;

  @IsInt()
  min_serialnumber: number;

  @IsInt()
  max_serialnumber: number;

  @IsOptional()
  @IsInt()
  numero_caja?: number;
}
