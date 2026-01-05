import { IsNotEmpty, IsString } from 'class-validator';

export class LeveransLoginDto {
  @IsNotEmpty({ message: 'El campo "username" es obligatorio.' })
  @IsString({ message: 'El campo "username" debe ser un texto.' })
  username: string;

  @IsNotEmpty({ message: 'El campo "bascula" es obligatorio.' })
  @IsString({ message: 'El campo "bascula" debe ser un texto.' })
  bascula: string;

  @IsNotEmpty({ message: 'El campo "shift" es obligatorio.' })
  @IsString({ message: 'El campo "shift" debe ser un texto.' })
  shift: string;
}
