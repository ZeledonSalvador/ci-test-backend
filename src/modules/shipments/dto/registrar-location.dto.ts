import { IsString, MaxLength } from 'class-validator';

export class RegistrarLocationDto {
  @IsString()
  @MaxLength(50)
  code: string;
}
