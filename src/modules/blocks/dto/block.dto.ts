import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class BlockDto {
  @IsString()
  @Length(1, 50)
  ingenioCode: string;

  @IsString()
  @Length(1, 50)
  productCode: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean; // true = bloquear, false = desbloquear (
}
