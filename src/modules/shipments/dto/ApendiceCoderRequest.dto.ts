import { IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ApendiceValuesObject {
  [key: string]: string | string[];
}

export class ApendiceCoderRequest {
  @IsObject()
  @ValidateNested()
  @Type(() => ApendiceValuesObject)
  @IsOptional()
  main?: { [key: string]: string | string[] };

  @IsObject()
  @ValidateNested()
  @Type(() => ApendiceValuesObject)
  @IsOptional()
  others?: { [key: string]: string | string[] };
}
