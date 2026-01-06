import { IsEnum, IsString, IsOptional } from 'class-validator';
import { Role } from '../enums/roles.enum';
import { IsExpirationFormat } from '../validator/IsExpirationFormatConstraint';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsEnum(Role, {
    message: `El rol debe ser uno de los siguientes valores: ${Object.values(Role).join(', ')}`,
  })
  rol: Role;

  @IsOptional()
  @IsString({
    message: 'La propiedad "expiration" debe ser una cadena de texto',
  })
  @IsExpirationFormat()
  expiration?: string;
}
