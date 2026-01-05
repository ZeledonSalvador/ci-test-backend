import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class InternalLoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  bascula?: string;

  @IsOptional()
  @IsString()
  turno?: string;
}