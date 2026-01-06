import { IsString, Length } from 'class-validator';

export class UnblockDto {
  @IsString()
  @Length(1, 50)
  ingenioCode: string;

  @IsString()
  @Length(1, 50)
  productCode: string;
}
