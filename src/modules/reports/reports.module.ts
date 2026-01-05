import { Module } from '@nestjs/common';
import { ReportsController } from './controllers/reports.controller';
import { ReportsService } from './services/reports.service';
import { ExcelExporter } from './exporters/excel/excel.exporter';
import { PdfExporter } from './exporters/pdf/pdf.exporter';
import { TruckEntryReportService } from './services/truck-entry.report';
import { AuthModule } from 'src/modules/auth/auth.module';
import { TempBrixChartService } from '../reports/services/temp-brix.service';
import { RequiresSweepingReportService } from './services/requires-sweeping.report';


@Module({
  imports: [AuthModule], 
  controllers: [ReportsController],
  providers: [ReportsService, ExcelExporter, PdfExporter, TruckEntryReportService, TempBrixChartService,RequiresSweepingReportService],
})
export class ReportsModule {}
