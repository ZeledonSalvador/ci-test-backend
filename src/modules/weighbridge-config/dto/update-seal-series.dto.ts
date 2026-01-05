// src/modules/weighbridge-config/dto/update-seal-series.dto.ts
import { IsString, Length, IsOptional } from 'class-validator';

export class UpdateSealSeriesDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  min_sealnumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  max_sealnumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  ingenio_code?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  product_code?: string;
}
