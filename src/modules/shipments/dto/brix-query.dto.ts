import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  Matches,
  IsNumber,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class BrixEligibleQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string;

  @IsOptional()
  @IsString()
  ingenio?: string;

  @IsOptional()
  @IsString()
  trailerPlate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber({}, { message: 'El tamaño debe ser un número.' })
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber({}, { message: 'El tamaño debe ser un número.' })
  pageSize?: number = 20;
}
