import { IsString, Length } from 'class-validator';

export class StatusQueryDto {
  @IsString()
  @Length(1, 50)
  ingenioCode: string;

  @IsString()
  @Length(1, 50)
  productCode: string;
}
