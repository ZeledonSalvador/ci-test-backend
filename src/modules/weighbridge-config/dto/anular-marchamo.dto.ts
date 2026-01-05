// src/modules/weighbridge-config/dto/anular-marchamo.dto.ts
import { IsString, Length, IsOptional, IsInt, Min } from 'class-validator';

export class AnularMarchamoDto {
  @IsString()
  @Length(1, 50)
  seal_code: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  motivo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  id_sealseries?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  id_shipment?: number;
}
