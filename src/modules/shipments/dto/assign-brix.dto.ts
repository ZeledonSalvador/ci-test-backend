// src/modules/shipments/dto/assign-brix.dto.ts
import { IsArray, ArrayMinSize, ArrayMaxSize, IsNumber, IsInt, Min, Max } from 'class-validator';

export class AssignBrixDto {
  @IsNumber()
  @Min(0)  @Max(100) // ajusta si tu escala es otra
  brix: number;

  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsInt({ each: true })
  shipments: number[];
}
