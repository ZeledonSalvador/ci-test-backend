import { IsNumber } from 'class-validator';

export class AsignarBuzzerDto {
  @IsNumber()
  buzzer: number;
}
