import { IsBooleanString, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  ingenioCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  productCode?: string;

  // "true" | "false"
  @IsOptional()
  @IsBooleanString()
  active?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 50;

  // campos válidos para ordenar
  @IsOptional()
  @IsString()
  sort?: 'ingenioCode' | 'productCode' | 'createdAt' | 'active' = 'ingenioCode';

  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc' = 'asc';
}
