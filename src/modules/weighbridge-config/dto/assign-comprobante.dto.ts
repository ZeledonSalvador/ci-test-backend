import { IsInt, Min } from 'class-validator';

export class AssignComprobanteDto {
  @IsInt()
  @Min(1)
  id_shipment: number;

  @IsInt()
  @Min(1)
  id_bascula: number;

  @IsInt()
  @Min(1)
  no_comprobante: number;
}
