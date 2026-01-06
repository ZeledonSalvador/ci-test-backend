import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { Role } from 'src/modules/auth/enums/roles.enum';

export class RegisterDto {
  @IsString({
    message: 'El nombre de usuario es requerido y debe ser una cadena.',
  })
  @IsNotEmpty({ message: 'El nombre de usuario es un campo requerido.' })
  username: string;

  @IsString({ message: 'La contraseña es requerida y debe ser una cadena.' })
  @IsNotEmpty({ message: 'La contraseña es un campo requerido.' })
  password: string;

  @IsNotEmpty({ message: 'El rol es un campo requerido.' })
  @IsEnum(Role, {
    message: `El rol debe ser uno de los siguientes valores: ${Object.values(Role).join(', ')}`,
  })
  role: Role;
}
