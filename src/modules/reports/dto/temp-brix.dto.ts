import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class TempBrixChartDto {
  @IsNotEmpty({ message: 'ingenioCode es requerido' })
  @IsString()
  @MaxLength(50)
  ingenioCode: string; // @IngenioCode

  @IsNotEmpty({ message: 'from es requerido' })
  @IsDateString({}, { message: 'from debe ser una fecha válida (YYYY-MM-DD)' })
  from: string; // @StartDate

  @IsNotEmpty({ message: 'to es requerido' })
  @IsDateString({}, { message: 'to debe ser una fecha válida (YYYY-MM-DD)' })
  to: string; // @EndDate

  @IsOptional()
  @IsString()
  @MaxLength(20)
  product?: string; // @Product (default MEL-001)
}
