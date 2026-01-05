// src/modules/shipments/dto/registrar-temperatura.dto.ts
import { IsNumber } from 'class-validator';

export class RegistrarTemperaturaDto {
  @IsNumber()
  temperature: number;
}
