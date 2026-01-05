// src/modules/weighbridge-config/dto/create-seal-series.dto.ts
import { IsInt, Min, IsString, Length } from 'class-validator';

export class CreateSealSeriesDto {
  @IsInt()
  @Min(1)
  id_bascula: number;

  @IsString()
  @Length(1, 50)
  min_sealnumber: string;

  @IsString()
  @Length(1, 50)
  max_sealnumber: string;

  @IsString()
  @Length(1, 50)
  ingenio_code: string;

  @IsString()
  @Length(1, 50)
  product_code: string;
}
