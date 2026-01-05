import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TruckEntryReportQueryDto } from '../dto/truck-entry.dto';

@Injectable()
export class TruckEntryReportService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getData(range: TruckEntryReportQueryDto) {
    const sqlRows = `
      WITH base AS (
        SELECT
          s2.id AS shipment_id,
          s2.code_gen AS codigo_generacion,
          MIN(CASE WHEN st.predefined_status_id = 5  THEN st.updated_at END) AS fechayhora_ingreso,
          MAX(CASE WHEN st.predefined_status_id = 12 THEN st.updated_at END) AS fechayhora_salida,
          d.name AS motorista,
          d.license AS licencia,
          v.plate AS placa_cabezal,
          v.trailer_plate AS placa_remolque,
          s2.transporter AS transportista
        FROM ingenioapi.dbo.Status st
        JOIN ingenioapi.dbo.Shipments s2 ON st.shipment_id = s2.id
        JOIN ingenioapi.dbo.Drivers d ON s2.driver_id = d.id
        JOIN ingenioapi.dbo.Vehicles v ON s2.vehicle_id = v.id
        WHERE st.predefined_status_id IN (5, 12)
        GROUP BY s2.id, s2.code_gen, d.name, d.license, v.plate, v.trailer_plate, s2.transporter
      )
      SELECT *
      FROM base
      WHERE fechayhora_ingreso IS NOT NULL
        AND fechayhora_salida IS NOT NULL
        AND fechayhora_ingreso >= CAST(@0 AS date)
        AND fechayhora_ingreso < DATEADD(DAY, 1, CAST(@1 AS date))
      ORDER BY fechayhora_ingreso DESC;
    `;

    const rows = await this.dataSource.query(sqlRows, [range.from, range.to]);

    const sqlSummary = `
      WITH base AS (
        SELECT
          MIN(CASE WHEN st.predefined_status_id = 5 THEN st.updated_at END) AS fechayhora_ingreso
        FROM ingenioapi.dbo.Status st
        JOIN ingenioapi.dbo.Shipments s2 ON st.shipment_id = s2.id
        WHERE st.predefined_status_id IN (5, 12)
        GROUP BY s2.id, s2.code_gen
        HAVING
          MIN(CASE WHEN st.predefined_status_id = 5  THEN st.updated_at END) IS NOT NULL
          AND MAX(CASE WHEN st.predefined_status_id = 12 THEN st.updated_at END) IS NOT NULL
      )
      SELECT
        COUNT(1) AS total,
        MIN(fechayhora_ingreso) AS minIngreso,
        MAX(fechayhora_ingreso) AS maxIngreso
      FROM base
      WHERE fechayhora_ingreso >= CAST(@0 AS date)
        AND fechayhora_ingreso < DATEADD(DAY, 1, CAST(@1 AS date));
    `;

    const [summaryRaw] = await this.dataSource.query(sqlSummary, [range.from, range.to]);

    return {
      rows,
      summary: {
        total: summaryRaw?.total ? Number(summaryRaw.total) : 0,
        minIngreso: summaryRaw?.minIngreso ?? null,
        maxIngreso: summaryRaw?.maxIngreso ?? null,
      },
      meta: {
        report: 'truck-entry',
        from: range.from,
        to: range.to,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}
