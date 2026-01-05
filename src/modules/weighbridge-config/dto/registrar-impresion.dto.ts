import { IsDateString, IsInt } from 'class-validator';

export class RegistrarImpresionDto {
  @IsInt()
  id_shipment: number;

  @IsDateString()
  fecha_impresion: string;
}
