import { IsNumber } from 'class-validator';

export class RegistrarHumedadDto {
  @IsNumber()
  humidity: number;
}
