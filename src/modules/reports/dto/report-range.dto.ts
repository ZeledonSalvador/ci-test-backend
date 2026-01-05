import { IsDateString } from 'class-validator';

export class ReportRangeDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}
