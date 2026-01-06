import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export class RegisterSimpleDto {
  @IsString({
    message: 'El nombre de usuario es requerido y debe ser una cadena.',
  })
  @IsNotEmpty({ message: 'El nombre de usuario es un campo requerido.' })
  username: string;

  @IsString({ message: 'La contraseña es requerida y debe ser una cadena.' })
  @IsNotEmpty({ message: 'La contraseña es un campo requerido.' })
  password: string;
}
