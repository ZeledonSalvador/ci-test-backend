import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class TruckEntryReportQueryDto {
  @IsDateString()
  from: string; // YYYY-MM-DD

  @IsDateString()
  to: string; // YYYY-MM-DD
}

export class TruckEntryExportQueryDto extends TruckEntryReportQueryDto {
  @IsIn(['excel', 'pdf'])
  format: 'excel' | 'pdf';

  @IsOptional()
  filename?: string;
}
