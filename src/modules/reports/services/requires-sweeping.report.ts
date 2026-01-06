import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequiresSweepingReportQueryDto } from '../dto/requires-sweeping.dto';

@Injectable()
export class RequiresSweepingReportService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getData(q: RequiresSweepingReportQueryDto) {
    // Obtener el nombre del ingenio si no se proporcionó
    let ingenioName = q.ingenioName;
    if (!ingenioName) {
      const sqlIngenioName = `
        SELECT TOP 1 REPLACE(name, '_', ' ') AS ingenio_name
        FROM ingenioapi.dbo.Clients
        WHERE ingenio_code = @0
      `;
      const [ingenioResult] = await this.dataSource.query(sqlIngenioName, [
        q.ingenioCode,
      ]);
      ingenioName = ingenioResult?.ingenio_name || q.ingenioCode;
    }

    const sqlRows = `
      WITH StatusFechas AS (
        SELECT
          st.shipment_id,
          MAX(CASE WHEN st.predefined_status_id = 2  THEN st.created_at END) AS fecha_prechequeo,
          MAX(CASE WHEN st.predefined_status_id = 5  THEN st.created_at END) AS fecha_entrada_planta,
          MAX(CASE WHEN st.predefined_status_id = 12 THEN st.created_at END) AS fecha_salida_planta
        FROM ingenioapi.dbo.Status AS st
        GROUP BY st.shipment_id
      ),
      BarridoElegido AS (
        SELECT
          ss.shipmentId,
          CASE
            WHEN MAX(CASE WHEN ss.sweepingType = 'DOBLE' THEN 1 ELSE 0 END) = 1 THEN 'DOBLE'
            WHEN MAX(CASE WHEN ss.sweepingType = 'SENCILLO' THEN 1 ELSE 0 END) = 1 THEN 'SENCILLO'
          END AS sweepingType
        FROM ingenioapi.dbo.ShipmentSweeping AS ss
        WHERE ss.requiresSweepingShipment = 'S'
        GROUP BY ss.shipmentId
      )
      SELECT
        REPLACE(c.name, '_', ' ') AS ingenio,
        s.code_gen AS codigo_generacion,
        s.id_nav_record AS id_nav,
        d.license AS licencia,
        d.name AS motorista,
        v.plate AS placa_cabezal,
        v.trailer_plate AS placa_remolque,
        'SI' AS solicito_barrido,
        be.sweepingType AS tipo_barrido,
        sf.fecha_prechequeo,
        sf.fecha_entrada_planta,
        sf.fecha_salida_planta
      FROM ingenioapi.dbo.Shipments AS s
      INNER JOIN ingenioapi.dbo.Clients  AS c ON c.ingenio_code = s.ingenio_id
      INNER JOIN ingenioapi.dbo.Vehicles AS v ON v.id = s.vehicle_id
      INNER JOIN ingenioapi.dbo.Drivers  AS d ON d.id = s.driver_id
      INNER JOIN StatusFechas            AS sf ON sf.shipment_id = s.id
      INNER JOIN BarridoElegido          AS be ON be.shipmentId = s.id
      WHERE s.current_status = 12
        AND c.ingenio_code = @0
        AND sf.fecha_prechequeo IS NOT NULL
        AND sf.fecha_entrada_planta IS NOT NULL
        AND sf.fecha_salida_planta IS NOT NULL
        AND CONVERT(date, sf.fecha_entrada_planta) BETWEEN CAST(@1 AS date) AND CAST(@2 AS date)
        AND CONVERT(date, sf.fecha_salida_planta)  BETWEEN CAST(@1 AS date) AND CAST(@2 AS date)
      ORDER BY sf.fecha_entrada_planta, sf.fecha_salida_planta;
    `;

    const rows = await this.dataSource.query(sqlRows, [
      q.ingenioCode,
      q.from,
      q.to,
    ]);

    const sqlSummary = `
      WITH StatusFechas AS (
        SELECT
          st.shipment_id,
          MAX(CASE WHEN st.predefined_status_id = 5  THEN st.created_at END) AS fecha_entrada_planta,
          MAX(CASE WHEN st.predefined_status_id = 12 THEN st.created_at END) AS fecha_salida_planta
        FROM ingenioapi.dbo.Status AS st
        GROUP BY st.shipment_id
      ),
      BarridoElegido AS (
        SELECT
          ss.shipmentId
        FROM ingenioapi.dbo.ShipmentSweeping AS ss
        WHERE ss.requiresSweepingShipment = 'S'
        GROUP BY ss.shipmentId
      )
      SELECT
        COUNT(1) AS total,
        MIN(sf.fecha_entrada_planta) AS minEntrada,
        MAX(sf.fecha_salida_planta) AS maxSalida
      FROM ingenioapi.dbo.Shipments AS s
      INNER JOIN ingenioapi.dbo.Clients AS c ON c.ingenio_code = s.ingenio_id
      INNER JOIN StatusFechas AS sf ON sf.shipment_id = s.id
      INNER JOIN BarridoElegido AS be ON be.shipmentId = s.id
      WHERE s.current_status = 12
        AND c.ingenio_code = @0
        AND sf.fecha_entrada_planta IS NOT NULL
        AND sf.fecha_salida_planta IS NOT NULL
        AND CONVERT(date, sf.fecha_entrada_planta) BETWEEN CAST(@1 AS date) AND CAST(@2 AS date)
        AND CONVERT(date, sf.fecha_salida_planta) BETWEEN CAST(@1 AS date) AND CAST(@2 AS date);
    `;

    const [summaryRaw] = await this.dataSource.query(sqlSummary, [
      q.ingenioCode,
      q.from,
      q.to,
    ]);

    return {
      rows,
      summary: {
        total: summaryRaw?.total ? Number(summaryRaw.total) : 0,
        minEntrada: summaryRaw?.minEntrada ?? null,
        maxSalida: summaryRaw?.maxSalida ?? null,
      },
      meta: {
        report: 'requiresSweeping',
        ingenioCode: q.ingenioCode,
        ingenioname: ingenioName,
        from: q.from,
        to: q.to,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}
