import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { ExcelExporter } from '../exporters/excel/excel.exporter';
import { PdfExporter } from '../exporters/PDF/pdf.exporter';

import { TempBrixChartDto } from '../dto/temp-brix.dto';
import { TempBrixChartService } from '../services/temp-brix.service';

import { RequiresSweepingReportService } from '../services/requires-sweeping.report';
import {
  RequiresSweepingExportQueryDto,
  RequiresSweepingReportQueryDto,
} from '../dto/requires-sweeping.dto';

import { TruckEntryReportService } from '../services/truck-entry.report';
import {
  TruckEntryExportQueryDto,
  TruckEntryReportQueryDto,
} from '../dto/truck-entry.dto';

@UseGuards(AuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly truckEntryReport: TruckEntryReportService,
    private readonly excelExporter: ExcelExporter,
    private readonly pdfExporter: PdfExporter,
    private readonly tempBrixChart: TempBrixChartService,
    private readonly requiresSweepingReport: RequiresSweepingReportService,
  ) {}

  // A) JSON preview/debug
  @Get('truck-entry')
  @Roles(Role.ADMIN, Role.BOT)
  async getTruckEntryReport(@Query() q: TruckEntryReportQueryDto) {
    return this.truckEntryReport.getData(q);
  }

  // B) Export (por ahora deja el wiring; luego metemos Excel/PDF con formato)
  @Get('truck-entry/export')
  @Roles(Role.ADMIN, Role.BOT)
  async exportTruckEntryReport(
    @Query() q: TruckEntryExportQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.truckEntryReport.getData(q);

    const filenameBase =
      q.filename?.trim() || `truck-entry_${q.from}_to_${q.to}`;

    if (q.format === 'excel') {
      const file = await this.excelExporter.buildTruckEntryWorkbook({
        rows: data.rows,
        meta: data.meta,
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filenameBase}.xlsx"`,
      );
      return res.send(file);
    }

    // pdf
    const pdf = await this.pdfExporter.buildTruckEntryPdf({
      rows: data.rows,
      meta: data.meta,
      summary: data.summary,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filenameBase}.pdf"`,
    );
    return res.send(pdf);
  }

  @Get('temperature-brix')
  @Roles(Role.ADMIN, Role.BOT)
  async temperatureBrix(@Query() dto: TempBrixChartDto) {
    return this.tempBrixChart.getChart(dto);
  }

  // A) JSON preview
  @Get('requires-sweeping')
  @Roles(Role.ADMIN, Role.BOT)
  async getRequiresSweeping(@Query() q: RequiresSweepingReportQueryDto) {
    return this.requiresSweepingReport.getData(q);
  }

  // B) Export
  @Get('requires-sweeping/export')
  @Roles(Role.ADMIN, Role.BOT)
  async exportRequiresSweeping(
    @Query() q: RequiresSweepingExportQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.requiresSweepingReport.getData(q);

    // Generar nombre con fecha y hora actual
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const dateTimeStr = `${day}-${month}-${year} ${hours}.${minutes}`;

    const filenameBase =
      q.filename?.trim() || `Requiere Barrido (${dateTimeStr})`;

    if (q.format === 'excel') {
      const file = await this.excelExporter.buildRequiresSweepingWorkbook({
        rows: data.rows,
        meta: data.meta,
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filenameBase}.xlsx"`,
      );
      return res.send(file);
    }

    const pdf = await this.pdfExporter.buildRequiresSweepingPdf({
      rows: data.rows,
      meta: data.meta,
      summary: data.summary,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filenameBase}.pdf"`,
    );
    return res.send(pdf);
  }
}