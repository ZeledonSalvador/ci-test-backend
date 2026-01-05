import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOperationTimeDto {
  @IsNumber({}, { message: 'shipmentId debe ser numérico' })
  @Type(() => Number) 
  shipmentId: number;


  @IsString()
  @IsNotEmpty()
  operationType: string;

  @IsString()
  @IsNotEmpty()
  duration: string;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsNotEmpty()
  truckType: string;
}
