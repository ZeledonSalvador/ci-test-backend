import { IsOptional, IsString } from 'class-validator';

export class UpdateMillDto {
  @IsOptional()
  @IsString()
  ingenioCode?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}
