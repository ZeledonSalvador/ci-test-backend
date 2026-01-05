import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TempBrixChartDto } from '../dto/temp-brix.dto';

type Row = {
  fecha_recepcion: string | Date;
  brix_promedio: number | null;
  temperatura_promedio: number | null;
};

@Injectable()
export class TempBrixChartService {
  constructor(private readonly dataSource: DataSource) {}

  async getChart(dto: TempBrixChartDto) {
    const ingenioCode = dto.ingenioCode;
    const from = dto.from;
    const to = dto.to;
    const product = dto.product ?? 'MEL-001';

    // Validar que los parámetros requeridos estén presentes
    if (!ingenioCode || !from || !to) {
      throw new BadRequestException(
        'Los parámetros ingenioCode, from y to son requeridos'
      );
    }

    // Importante (SQL Server + TypeORM):
    // TypeORM con MSSQL suele mapear parámetros posicionales como @0, @1, @2...
    // (en tu repo ya estás usando dataSource.query(sql, [..]) así que mantenemos eso).
    const sqlRows = `
      WITH IngresoPlanta AS (
        SELECT
            s2.shipment_id,
            MIN(s2.created_at) AS ingreso_planta_at
        FROM ingenioapi.dbo.Status s2
        WHERE s2.predefined_status_id = 13
        GROUP BY s2.shipment_id
      ),
      TempPorEnvio AS (
        SELECT
            st.shipment_id,
            AVG(CAST(st.temperature AS DECIMAL(10,4))) AS temp_prom_envio
        FROM ingenioapi.dbo.ShipmentsTemperature st
        GROUP BY st.shipment_id
      )
      SELECT
          CAST(ip.ingreso_planta_at AS DATE) AS fecha_recepcion,
          ROUND(AVG(CAST(s.brix AS DECIMAL(10,4))), 1) AS brix_promedio,
          ROUND(AVG(tpe.temp_prom_envio), 1)           AS temperatura_promedio
      FROM ingenioapi.dbo.Shipments s
      INNER JOIN ingenioapi.dbo.Clients c
          ON c.ingenio_code = s.ingenio_id
      INNER JOIN IngresoPlanta ip
          ON ip.shipment_id = s.id
      LEFT JOIN TempPorEnvio tpe
          ON tpe.shipment_id = s.id
      WHERE c.ingenio_code = @0
        AND s.product = @1
        AND ip.ingreso_planta_at >= CAST(@2 AS date)
        AND ip.ingreso_planta_at <  DATEADD(DAY, 1, CAST(@3 AS date))
      GROUP BY CAST(ip.ingreso_planta_at AS DATE)
      ORDER BY fecha_recepcion;
    `;

    const rows: Row[] = await this.dataSource.query(sqlRows, [
      ingenioCode,
      product,
      from,
      to,
    ]);

    // Summary sobre el resultado diario (AVG/MIN/MAX de los promedios diarios)
    const sqlSummary = `
      WITH IngresoPlanta AS (
        SELECT s2.shipment_id, MIN(s2.created_at) AS ingreso_planta_at
        FROM ingenioapi.dbo.Status s2
        WHERE s2.predefined_status_id = 13
        GROUP BY s2.shipment_id
      ),
      TempPorEnvio AS (
        SELECT st.shipment_id,
               AVG(CAST(st.temperature AS DECIMAL(10,4))) AS temp_prom_envio
        FROM ingenioapi.dbo.ShipmentsTemperature st
        GROUP BY st.shipment_id
      ),
      Daily AS (
        SELECT
          CAST(ip.ingreso_planta_at AS DATE) AS fecha_recepcion,
          ROUND(AVG(CAST(s.brix AS DECIMAL(10,4))), 1) AS brix_promedio,
          ROUND(AVG(tpe.temp_prom_envio), 1)           AS temperatura_promedio
        FROM ingenioapi.dbo.Shipments s
        INNER JOIN ingenioapi.dbo.Clients c
          ON c.ingenio_code = s.ingenio_id
        INNER JOIN IngresoPlanta ip
          ON ip.shipment_id = s.id
        LEFT JOIN TempPorEnvio tpe
          ON tpe.shipment_id = s.id
        WHERE c.ingenio_code = @0
          AND s.product = @1
          AND ip.ingreso_planta_at >= CAST(@2 AS date)
          AND ip.ingreso_planta_at <  DATEADD(DAY, 1, CAST(@3 AS date))
        GROUP BY CAST(ip.ingreso_planta_at AS DATE)
      )
      SELECT
        COUNT(1) AS days,
        ROUND(AVG(CAST(brix_promedio AS DECIMAL(10,4))), 1) AS brix_avg,
        MIN(brix_promedio) AS brix_min,
        MAX(brix_promedio) AS brix_max,
        ROUND(AVG(CAST(temperatura_promedio AS DECIMAL(10,4))), 1) AS temp_avg,
        MIN(temperatura_promedio) AS temp_min,
        MAX(temperatura_promedio) AS temp_max
      FROM Daily;
    `;

    const summaryRow = (await this.dataSource.query(sqlSummary, [
      ingenioCode,
      product,
      from,
      to,
    ]))?.[0] ?? {};

    // Normalizamos fechas a YYYY-MM-DD para labels
    const rowsNormalized = rows.map((r) => {
      const d = r.fecha_recepcion instanceof Date ? r.fecha_recepcion : new Date(r.fecha_recepcion);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return {
        date: `${yyyy}-${mm}-${dd}`,
        temperatureAvg: r.temperatura_promedio ?? null,
        brixAvg: r.brix_promedio ?? null,
      };
    });

    const labels = rowsNormalized.map((r) => r.date);

    return {
      labels,
      datasets: [
        {
          key: 'temperatureAvg',
          label: 'Temperatura °C Promedio',
          type: 'bar',
          yAxisID: 'yTemp',
          data: rowsNormalized.map((r) => r.temperatureAvg),
        },
        {
          key: 'brixAvg',
          label: '°Brix Promedio',
          type: 'line',
          yAxisID: 'yBrix',
          data: rowsNormalized.map((r) => r.brixAvg),
        },
      ],
      rows: rowsNormalized,
      summary: {
        days: Number(summaryRow.days ?? 0),
        temperature: {
          avg: summaryRow.temp_avg ?? null,
          min: summaryRow.temp_min ?? null,
          max: summaryRow.temp_max ?? null,
        },
        brix: {
          avg: summaryRow.brix_avg ?? null,
          min: summaryRow.brix_min ?? null,
          max: summaryRow.brix_max ?? null,
        },
      },
      meta: {
        chart: 'temperature-brix',
        ingenioCode,
        product,
        from,
        to,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}
