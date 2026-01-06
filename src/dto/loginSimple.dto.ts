import { IsString, IsOptional } from 'class-validator';
import { IsExpirationFormat } from 'src/modules/auth/validator/IsExpirationFormatConstraint';

export class LoginSimpleDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString({
    message: 'La propiedad "expiration" debe ser una cadena de texto',
  })
  @IsExpirationFormat()
  expiration?: string;
}
