import { IsIn, IsOptional } from 'class-validator';

export class ExportQueryDto {
  @IsIn(['excel', 'pdf'])
  format: 'excel' | 'pdf';

  @IsOptional()
  filename?: string;
}
