// shipment-times.dto.ts
import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsDateString,
  IsBooleanString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ShipmentTimesFilterDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  mode!: number;

  @IsOptional() @IsString() license?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsBooleanString() onlyCompleted?: 'true' | 'false';

  @IsOptional()
  @IsIn(['pdf', 'excel'])
  format?: 'pdf' | 'excel';
}
