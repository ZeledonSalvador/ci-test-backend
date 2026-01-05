import {
  IsInt,
  Min,
  IsArray,
  ArrayMinSize,
  IsString,
} from 'class-validator';

export class CreateMarchamoDto {
  @IsInt()
  @Min(1)
  idShipment: number;

  @IsInt()
  @Min(1)
  idBascula: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  sealCodes: string[];
}
