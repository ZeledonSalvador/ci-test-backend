import { IsInt, Min } from 'class-validator';

export class RegistrarPesosDto {
  @IsInt()
  @Min(0)
  navStatus: number; // nuevo estatus NAV
}
