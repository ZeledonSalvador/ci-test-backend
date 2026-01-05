import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RequiresSweepingReportQueryDto {
  @IsString()
  @MaxLength(50)
  ingenioCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ingenioName?: string;

  @IsDateString()
  from: string; // YYYY-MM-DD

  @IsDateString()
  to: string; // YYYY-MM-DD
}

export class RequiresSweepingExportQueryDto extends RequiresSweepingReportQueryDto {
  @IsIn(['excel', 'pdf'])
  format: 'excel' | 'pdf';

  @IsOptional()
  filename?: string;
}
