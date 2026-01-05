import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

function secToHHMMSS(totalSec?: number | null): string | 0 {
  if (totalSec == null) return 0;
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600).toString().padStart(2, '0');
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) { }

  // Valida que existan en la BD los valores de product/ingenioId.
  private async assertFilterValuesExist(product?: string, ingenioId?: string) {
    // PRODUCT
    if (product) {
      const existsProduct = await this.dataSource.query(
        `
        SELECT TOP 1 1 AS ok
        FROM  Shipments
        WHERE UPPER(LTRIM(RTRIM(product))) = UPPER(LTRIM(RTRIM(@0)));
        `,
        [product],
      );
      if (!existsProduct?.length) {
        throw new BadRequestException(`Producto no válido: "${product}".`);
      }
    }

    // INGENIO
    if (ingenioId) {
      const existsIngenio = await this.dataSource.query(
        `
        SELECT TOP 1 1 AS ok
        FROM  Shipments
        WHERE UPPER(LTRIM(RTRIM(ingenio_id))) = UPPER(LTRIM(RTRIM(@0)));
        `,
        [ingenioId],
      );
      if (!existsIngenio?.length) {
        throw new BadRequestException(`Ingenio no válido: "${ingenioId}".`);
      }
    }
  }

  /**
   * Resumen por estatus:
   * {
   *   Producto, Ingenio, Rango: { Start, End },
   *   EnTransito: { Total, Dias: [{ Fecha, Total, TruckType: {...} }] }, ...
   * }
   * - Rango: [start, end) (end exclusivo)
   * - Filtros opcionales: product (Shipments.product), ingenioId (Shipments.ingenio_id)
   * - Si product o ingenioId no existen en BD => 400
   */
  async getResumenTodosLosEstatus(
    start: Date,
    end: Date,
    product?: string,
    ingenioId?: string,
  ): Promise<any> {
    await this.assertFilterValuesExist(product, ingenioId);

    const sql = `
DECLARE @start       DATETIME     = @0;
DECLARE @end         DATETIME     = @1;
DECLARE @product     NVARCHAR(50) = @2;
DECLARE @ingenioId   NVARCHAR(50) = @3;

DECLARE @startDate DATE = CONVERT(DATE, @start);
DECLARE @endDateEx DATE = CONVERT(DATE, @end);

;WITH DateList AS (
  SELECT DATEADD(DAY, n-1, @startDate) AS d
  FROM (
    SELECT TOP (DATEDIFF(DAY, @startDate, @endDateEx))
           ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
    FROM sys.all_objects
  ) q
),
StatusKeys AS (
  SELECT v.statusKey
  FROM (VALUES
    ('EnTransito'), ('Prechequeado'), ('Autorizado'), ('EnProceso'),
    ('Finalizado'), ('Pendiente'), ('Anulado'), ('EnEnfriamiento')
  ) v(statusKey)
),
/* === EVENTOS: 1 por envío/día/status (dedup) === */
Dedup AS (
  SELECT
    CONVERT(DATE, st.created_at) AS fecha,
    st.predefined_status_id,
    /* normalización del tipo de camión */
    CASE 
      WHEN UPPER(LTRIM(RTRIM(v.truck_type))) IN ('R','PLANA','PLANAS','PLANO','PLANOS') THEN 'Planas'
      WHEN UPPER(LTRIM(RTRIM(v.truck_type))) IN ('V','VOLTEO','VOLTEOS','T')           THEN 'Volteo'
      WHEN UPPER(LTRIM(RTRIM(v.truck_type))) IN ('P','PI','PIPA','PIPAS')              THEN 'Pipa'
      ELSE 'Otro'
    END AS truckCat,
    s.id AS shipment_id,
    ROW_NUMBER() OVER (
      PARTITION BY s.id, CONVERT(DATE, st.created_at), st.predefined_status_id
      ORDER BY st.created_at
    ) AS rn
  FROM  Status st
  JOIN  Shipments s ON s.id = st.shipment_id
  JOIN  Vehicles  v ON v.id = s.vehicle_id
  WHERE
    st.created_at >= @start AND st.created_at < @end
    AND (@product   IS NULL OR UPPER(LTRIM(RTRIM(s.product)))    = UPPER(LTRIM(RTRIM(@product))))
    AND (@ingenioId IS NULL OR UPPER(LTRIM(RTRIM(s.ingenio_id))) = UPPER(LTRIM(RTRIM(@ingenioId))))
),
Agg AS (
  SELECT
    d.fecha,
    CASE 
      WHEN d.predefined_status_id = 1  THEN 'EnTransito'
      WHEN d.predefined_status_id BETWEEN 2 AND 3  THEN 'Prechequeado'
      WHEN d.predefined_status_id = 4  THEN 'Autorizado'
      WHEN d.predefined_status_id BETWEEN 5 AND 11 THEN 'EnProceso'
      WHEN d.predefined_status_id = 12 THEN 'Finalizado'
      WHEN d.predefined_status_id = 13 THEN 'Pendiente'
      WHEN d.predefined_status_id = 14 THEN 'Anulado'
      WHEN d.predefined_status_id = 15 THEN 'EnEnfriamiento'
      ELSE 'Otro'
    END AS statusKey,
    d.truckCat,
    COUNT_BIG(*) AS cnt
  FROM Dedup d
  WHERE d.rn = 1
  GROUP BY
    d.fecha,
    d.truckCat,
    CASE 
      WHEN d.predefined_status_id = 1  THEN 'EnTransito'
      WHEN d.predefined_status_id BETWEEN 2 AND 3  THEN 'Prechequeado'
      WHEN d.predefined_status_id = 4  THEN 'Autorizado'
      WHEN d.predefined_status_id BETWEEN 5 AND 11 THEN 'EnProceso'
      WHEN d.predefined_status_id = 12 THEN 'Finalizado'
      WHEN d.predefined_status_id = 13 THEN 'Pendiente'
      WHEN d.predefined_status_id = 14 THEN 'Anulado'
      WHEN d.predefined_status_id = 15 THEN 'EnEnfriamiento'
      ELSE 'Otro'
    END
),
Pvt AS (
  SELECT
    fecha,
    statusKey,
    SUM(CASE WHEN truckCat = 'Planas' THEN cnt ELSE 0 END) AS Planas,
    SUM(CASE WHEN truckCat = 'Volteo' THEN cnt ELSE 0 END) AS Volteo,
    SUM(CASE WHEN truckCat = 'Pipa'   THEN cnt ELSE 0 END) AS Pipa,
    SUM(CASE WHEN truckCat = 'Otro'   THEN cnt ELSE 0 END) AS Otro
  FROM Agg
  GROUP BY fecha, statusKey
),
Grid AS (
  SELECT d.d AS fecha, sk.statusKey
  FROM DateList d
  CROSS JOIN StatusKeys sk
)
SELECT
  g.fecha,
  g.statusKey,
  ISNULL(p.Planas,0) AS Planas,
  ISNULL(p.Volteo,0) AS Volteo,
  ISNULL(p.Pipa,0)   AS Pipa,
  ISNULL(p.Otro,0)   AS Otro,
  ISNULL(p.Planas,0) + ISNULL(p.Volteo,0) + ISNULL(p.Pipa,0) + ISNULL(p.Otro,0) AS TotalDia
FROM Grid g
LEFT JOIN Pvt p
       ON p.fecha = g.fecha AND p.statusKey = g.statusKey
ORDER BY g.fecha, g.statusKey;

  `;

    const rows: Array<{
      fecha: string | Date;
      statusKey: 'EnTransito' | 'Prechequeado' | 'Autorizado' | 'EnProceso' | 'Finalizado' | 'Pendiente' | 'Anulado' | 'EnEnfriamiento' | 'Otro';
      Planas: number; Volteo: number; Pipa: number; Otro: number; TotalDia: number;
    }> = await this.dataSource.query(sql, [start, end, product ?? null, ingenioId ?? null]);

    // ---- post-procesado (igual que ya tenías) ----
    const statusKeys = ['EnTransito', 'Prechequeado', 'Autorizado', 'EnProceso', 'Finalizado', 'Pendiente', 'Anulado', 'EnEnfriamiento'] as const;

    const startDate = new Date(start);
    const endDate = new Date(end);
    const dayList: string[] = [];
    for (let d = new Date(startDate); d < endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      dayList.push(`${y}-${m}-${dd}`);
    }
    const toDDMMYY = (isoYMD: string) => {
      const [y, m, d] = isoYMD.split('-');
      return `${d}-${m}-${y.slice(2)}`;
    };

    const map = new Map<string, { Planas: number; Volteo: number; Pipa: number; Otro: number; TotalDia: number; }>();
    for (const r of rows) {
      const dt = (r.fecha instanceof Date) ? r.fecha.toISOString().slice(0, 10) : new Date(r.fecha).toISOString().slice(0, 10);
      map.set(`${dt}|${r.statusKey}`, {
        Planas: +r['Planas'] || 0, Volteo: +r['Volteo'] || 0, Pipa: +r['Pipa'] || 0, Otro: +r['Otro'] || 0, TotalDia: +r['TotalDia'] || 0
      });
    }

    const result: any = {
      Producto: product ?? null,
      Ingenio: ingenioId ?? null,
      Rango: { Start: start.toISOString(), End: end.toISOString() },
    };

    for (const sk of statusKeys) {
      const dias = [];
      let totalStatus = 0;
      for (const ymd of dayList) {
        const found = map.get(`${ymd}|${sk}`) ?? { Planas: 0, Volteo: 0, Pipa: 0, Otro: 0, TotalDia: 0 };
        totalStatus += found.TotalDia;
        dias.push({
          Fecha: toDDMMYY(ymd),
          Total: found.TotalDia,
          TruckType: { Planas: found.Planas, Volteo: found.Volteo, Pipa: found.Pipa, Otro: found.Otro },
        });
      }
      result[sk] = { Total: totalStatus, Dias: dias };
    }

    return result;
  }

  async getResumenHoyPorHora(
    product?: string,
    ingenioId?: string,
    horaDesde?: string,   // "HH:mm" o "H"
    horaHasta?: string    // "HH:mm" o "H"
  ) {
    await this.assertFilterValuesExist(product, ingenioId);

    const params: any[] = [];
    const addParam = (v: any) => { const i = params.length; params.push(v); return `@${i}`; };

    // Filtros
    let filterSh = '';
    if (product) filterSh += ` AND UPPER(LTRIM(RTRIM(sh.product)))    = UPPER(LTRIM(RTRIM(${addParam(product)})))`;
    if (ingenioId) filterSh += ` AND UPPER(LTRIM(RTRIM(sh.ingenio_id))) = UPPER(LTRIM(RTRIM(${addParam(ingenioId)})))`;

    // ===== Rango hora local -> UTC; ventana semiabierta [from, to) =====
    function parseHHmm(s?: string): { h: number; m: number } | null {
      if (!s) return null;
      const m = /^(\d{1,2})(?::([0-5]\d))?$/.exec(s.trim());
      if (!m) throw new Error('Formato de hora inválido. Use "HH:mm".');
      const h = +m[1], mm = +(m[2] ?? 0);
      if (h < 0 || h > 23) throw new Error('Hora fuera de rango (0–23).');
      return { h, m: mm };
    }

    const tzOffsetMin = new Date().getTimezoneOffset(); // típicamente 360 en UTC-6
    const todayLocal = new Date(); todayLocal.setHours(0, 0, 0, 0);

    const fromParts = parseHHmm(horaDesde);
    const toParts = parseHHmm(horaHasta);

    let fromLocal = new Date(todayLocal);
    let toLocal = new Date(todayLocal);

    if (fromParts) fromLocal.setHours(fromParts.h, fromParts.m, 0, 0);

    if (toParts) {
      // Interpretar hourTo como INCLUSIVO por hora (incluir la hora 'toParts.h')
      toLocal.setHours(toParts.h, toParts.m, 0, 0);
      // +1 hora para que el SQL [from, to) cubra la hora 'toParts.h' completa
      toLocal = new Date(toLocal.getTime() + 60 * 60 * 1000);
    } else if (fromParts) {
      // solo desde => ventana de 60 minutos
      toLocal = new Date(fromLocal.getTime() + 60 * 60 * 1000);
    } else {
      // día completo
      toLocal.setDate(toLocal.getDate() + 1);
    }


    if (fromLocal >= toLocal) throw new Error('Rango de minutos inválido: "horaDesde" debe ser < "horaHasta".');

    // a UTC real (lo que compara SQL Server)
    const fromDt = fromLocal;
    const toDt = toLocal;

    const pFromSql = addParam(fromDt);
    const pToSql = addParam(toDt);

    // ===== Agregado por HORA x ESTATUS x TruckType (incluye envíos sin vehículo) =====
    const sqlHoras = `
      WITH UltimoStatus AS (
        SELECT
          st.shipment_id,
          MAX(st.created_at) AS last_status_time
        FROM dbo.Status st
        GROUP BY st.shipment_id
      ),
      Actual AS (
        SELECT
          DATEPART(HOUR, s.created_at) AS h,
          CASE 
            WHEN s.predefined_status_id = 1  THEN 'EnTransito'
            WHEN s.predefined_status_id BETWEEN 2 AND 3  THEN 'Prechequeado'
            WHEN s.predefined_status_id = 4  THEN 'Autorizado'
            WHEN s.predefined_status_id BETWEEN 5 AND 11 THEN 'EnProceso'
            WHEN s.predefined_status_id = 12 THEN 'Finalizado'
            WHEN s.predefined_status_id = 13 THEN 'Pendiente'
            WHEN s.predefined_status_id = 14 THEN 'Anulado'
            WHEN s.predefined_status_id = 15 THEN 'EnEnfriamiento'
            ELSE 'Otro'
          END AS statusKey,
          CASE 
            WHEN UPPER(LTRIM(RTRIM(v.truck_type))) IN ('R','PLANA','PLANAS')       THEN 'Planas'
            WHEN UPPER(LTRIM(RTRIM(v.truck_type))) IN ('T','V','VOLTEO','VOLTEOS') THEN 'Volteo'
            WHEN UPPER(LTRIM(RTRIM(v.truck_type))) IN ('P','PIPA','PIPAS')         THEN 'Pipa'
            ELSE 'Otro'
          END AS truckCat
        FROM dbo.Status s
        INNER JOIN UltimoStatus u
          ON u.shipment_id = s.shipment_id AND u.last_status_time = s.created_at
        JOIN dbo.Shipments sh ON sh.id = s.shipment_id
        LEFT JOIN dbo.Vehicles v ON v.id = sh.vehicle_id
        WHERE s.created_at >= ${pFromSql}
          AND s.created_at < ${pToSql}
          ${filterSh}
      )
      SELECT
        h,
        statusKey,
        SUM(CASE WHEN truckCat='Planas' THEN 1 ELSE 0 END) AS Planas,
        SUM(CASE WHEN truckCat='Volteo' THEN 1 ELSE 0 END) AS Volteo,
        SUM(CASE WHEN truckCat='Pipa'   THEN 1 ELSE 0 END) AS Pipa,
        SUM(CASE WHEN truckCat='Otro'   THEN 1 ELSE 0 END) AS Otro
      FROM Actual
      GROUP BY h, statusKey;
      `;

    // Ejecutar solo la consulta por horas
    const horasRows = await this.dataSource.query(sqlHoras, params);

    // ===== Preparar estructura por estatus y horas =====
    const startISO = fromLocal.toISOString().slice(0, 19);
    const endISO = toLocal.toISOString().slice(0, 19);

    const firstHour = fromParts ? fromParts.h : 0;
    const lastHour = toParts
      ? Math.max(firstHour, toParts.h)  // INCLUSIVO
      : (fromParts ? firstHour : 23);

    const makeHoras = (h0: number, h1: number) => {
      const arr: Array<{ Hora: string; Total: number; TruckType: { Planas: number; Volteo: number; Pipa: number; Otro: number } }> = [];
      for (let h = h0; h <= h1; h++) {
        arr.push({
          Hora: `${h.toString().padStart(2, '0')}:00`,
          Total: 0,
          TruckType: { Planas: 0, Volteo: 0, Pipa: 0, Otro: 0 }
        });
      }
      return arr;
    };

    const bloques: Record<
      'EnTransito' | 'Prechequeado' | 'Autorizado' | 'EnProceso' | 'Finalizado' | 'Pendiente' | 'Anulado' | 'EnEnfriamiento',
      { Total: number; Horas: Array<{ Hora: string; Total: number; TruckType: { Planas: number; Volteo: number; Pipa: number; Otro: number } }> }
    > = {
      EnTransito: { Total: 0, Horas: makeHoras(firstHour, lastHour) },
      Prechequeado: { Total: 0, Horas: makeHoras(firstHour, lastHour) },
      Autorizado: { Total: 0, Horas: makeHoras(firstHour, lastHour) },
      EnProceso: { Total: 0, Horas: makeHoras(firstHour, lastHour) },
      Finalizado: { Total: 0, Horas: makeHoras(firstHour, lastHour) },
      Pendiente: { Total: 0, Horas: makeHoras(firstHour, lastHour) },
      Anulado: { Total: 0, Horas: makeHoras(firstHour, lastHour) },
      EnEnfriamiento: { Total: 0, Horas: makeHoras(firstHour, lastHour) },
    };

    // Rellenar desde SQL
    for (const r of horasRows) {
      const key = r.statusKey as keyof typeof bloques;
      if (!bloques[key]) continue;
      const h = Number(r.h);
      if (!Number.isInteger(h) || h < firstHour || h > lastHour) continue;

      const slot = bloques[key].Horas[h - firstHour];
      slot.TruckType.Planas += Number(r.Planas) || 0;
      slot.TruckType.Volteo += Number(r.Volteo) || 0;
      slot.TruckType.Pipa += Number(r.Pipa) || 0;
      slot.TruckType.Otro += Number(r.Otro) || 0;
      slot.Total = slot.TruckType.Planas + slot.TruckType.Volteo + slot.TruckType.Pipa + slot.TruckType.Otro;
      bloques[key].Total += slot.Total;
    }

    // ===== TotalDB derivado DIRECTO de los bloques (consistencia 1:1) =====
    const TotalDB = {
      Total: (
        bloques.EnTransito.Total +
        bloques.Prechequeado.Total +
        bloques.Autorizado.Total +
        bloques.EnProceso.Total +
        bloques.Finalizado.Total +
        bloques.Pendiente.Total +
        bloques.Anulado.Total +
        bloques.EnEnfriamiento.Total
      ),
      EnTransito: bloques.EnTransito.Total,
      Prechequeado: bloques.Prechequeado.Total,
      Autorizado: bloques.Autorizado.Total,
      EnProceso: bloques.EnProceso.Total,
      Finalizado: bloques.Finalizado.Total,
      Pendiente: bloques.Pendiente.Total,
      Anulado: bloques.Anulado.Total,
      EnEnfriamiento: bloques.EnEnfriamiento.Total,
    };

    return {
      Producto: product ?? null,
      Ingenio: ingenioId ?? null,
      Rango: { Start: startISO, End: endISO },
      TotalDB,
      EnTransito: bloques.EnTransito,
      Prechequeado: bloques.Prechequeado,
      Autorizado: bloques.Autorizado,
      EnProceso: bloques.EnProceso,
      Finalizado: bloques.Finalizado,
      Pendiente: bloques.Pendiente,
      Anulado: bloques.Anulado,
      EnEnfriamiento: bloques.EnEnfriamiento,
    };
  }


  async getPromediosAtencion(
    start?: Date,
    end?: Date,
    product?: string,
    ingenioId?: string,
  ) {
    await this.assertFilterValuesExist(product, ingenioId);

    // Parámetros posicionales (@0, @1, ...)
    const params: any[] = [];
    const add = (v: any) => { const i = params.length; params.push(v); return `@${i}`; };

    // Filtros opcionales por producto/ingenio (sobre Shipments)
    let filterShip = '';
    if (product) filterShip += ` AND UPPER(LTRIM(RTRIM( Shipments.product)))    = UPPER(LTRIM(RTRIM(${add(product)})))`;
    if (ingenioId) filterShip += ` AND UPPER(LTRIM(RTRIM( Shipments.ingenio_id))) = UPPER(LTRIM(RTRIM(${add(ingenioId)})))`;

    // Ventanas (HAVING) sobre el estado destino
    let having24 = ''; // destino = 4
    if (start) having24 += ` AND MIN(CASE WHEN  Status.predefined_status_id = 4  THEN  Status.created_at END) >= ${add(start)}`;
    if (end) having24 += ` AND MIN(CASE WHEN  Status.predefined_status_id = 4  THEN  Status.created_at END) <  ${add(end)}`;

    let having511 = ''; // destino = 11
    if (start) having511 += ` AND MIN(CASE WHEN  Status.predefined_status_id = 11 THEN  Status.created_at END) >= ${add(start)}`;
    if (end) having511 += ` AND MIN(CASE WHEN  Status.predefined_status_id = 11 THEN  Status.created_at END) <  ${add(end)}`;

    const sql = `
/* ===== Tramo 2 -> 4 (ESPERA) ===== */
WITH base24 AS (
  SELECT
     Status.shipment_id,
    MIN(CASE WHEN  Status.predefined_status_id = 2 THEN  Status.created_at END) AS t2,
    MIN(CASE WHEN  Status.predefined_status_id = 4 THEN  Status.created_at END) AS t4,
    -- producto y cantidad por embarque (cantidad = product_quantity_kg)
    LTRIM(RTRIM( Shipments.product)) AS producto,
    MAX(COALESCE(CAST( Shipments.product_quantity_kg AS float), 0.0)) AS qty
  FROM  Status
  JOIN  Shipments
       ON  Shipments.id =  Status.shipment_id
  WHERE  Status.predefined_status_id IN (2,4)
    ${filterShip}
  GROUP BY  Status.shipment_id,
           LTRIM(RTRIM( Shipments.product))
  HAVING
       MIN(CASE WHEN  Status.predefined_status_id = 2 THEN  Status.created_at END) IS NOT NULL
   AND MIN(CASE WHEN  Status.predefined_status_id = 4 THEN  Status.created_at END) IS NOT NULL
   AND MIN(CASE WHEN  Status.predefined_status_id = 4 THEN  Status.created_at END)
       >= MIN(CASE WHEN  Status.predefined_status_id = 2 THEN  Status.created_at END)
   ${having24}
),
agg24 AS (
  SELECT
    CAST(t4 AS date) AS fecha,
    producto,
    DATEDIFF(SECOND, t2, t4) AS diff_sec,
    qty
  FROM base24
),

/* ===== Tramo 5 -> 11 (ATENCIÓN) ===== */
base5_11 AS (
  SELECT
     Status.shipment_id,
    MIN(CASE WHEN  Status.predefined_status_id = 5  THEN  Status.created_at END) AS t5,
    MIN(CASE WHEN  Status.predefined_status_id = 11 THEN  Status.created_at END) AS t11,
    -- producto y cantidad por embarque (cantidad = product_quantity_kg)
    LTRIM(RTRIM( Shipments.product)) AS producto,
    MAX(COALESCE(CAST( Shipments.product_quantity_kg AS float), 0.0)) AS qty
  FROM  Status
  JOIN  Shipments
       ON  Shipments.id =  Status.shipment_id
  WHERE  Status.predefined_status_id IN (5,11)
    ${filterShip}
  GROUP BY  Status.shipment_id,
           LTRIM(RTRIM( Shipments.product))
  HAVING
       MIN(CASE WHEN  Status.predefined_status_id = 5  THEN  Status.created_at END) IS NOT NULL
   AND MIN(CASE WHEN  Status.predefined_status_id = 11 THEN  Status.created_at END) IS NOT NULL
   AND MIN(CASE WHEN  Status.predefined_status_id = 11 THEN  Status.created_at END)
       >= MIN(CASE WHEN  Status.predefined_status_id = 5  THEN  Status.created_at END)
   ${having511}
),
agg5_11 AS (
  SELECT
    CAST(t11 AS date) AS fecha,
    producto,
    DATEDIFF(SECOND, t5, t11) AS diff_sec,
    qty
  FROM base5_11
)

-- ======= Resultado unificado (mismas columnas/orden en cada SELECT) =======
-- Columnas: tramo, nivel, fecha, producto, total_pares, cantidad, promedio_seg, promedio_hhmmss
-- Nota: en GLOBAL, 'cantidad' será el PROMEDIO de qty; en DIA, 'cantidad' es la SUMA por día+producto.
SELECT
  N'2-4'                             AS tramo,
  N'GLOBAL'                          AS nivel,
  CAST(NULL AS date)                 AS fecha,
  CAST(NULL AS nvarchar(100))        AS producto,
  CAST(COUNT(*) AS int)              AS total_pares,
  CAST(COALESCE(AVG(qty),0) AS float)            AS cantidad,       -- ← PROMEDIO global
  CAST(COALESCE(AVG(1.0 * diff_sec),0) AS float) AS promedio_seg,
  CONVERT(varchar(8), DATEADD(SECOND, CAST(COALESCE(AVG(1.0 * diff_sec),0) AS int), 0), 108) AS promedio_hhmmss
FROM agg24

UNION ALL
SELECT
  N'2-4'                             AS tramo,
  N'DIA'                             AS nivel,
  fecha                              AS fecha,
  producto                           AS producto,
  CAST(NULL AS int)                  AS total_pares,
  CAST(SUM(qty) AS float)            AS cantidad,       -- ← SUMA por día+producto
  CAST(COALESCE(AVG(1.0 * diff_sec),0) AS float) AS promedio_seg,
  CONVERT(varchar(8), DATEADD(SECOND, CAST(COALESCE(AVG(1.0 * diff_sec),0) AS int), 0), 108) AS promedio_hhmmss
FROM agg24
GROUP BY fecha, producto

UNION ALL
SELECT
  N'5-11'                            AS tramo,
  N'GLOBAL'                          AS nivel,
  CAST(NULL AS date)                 AS fecha,
  CAST(NULL AS nvarchar(100))        AS producto,
  CAST(COUNT(*) AS int)              AS total_pares,
  CAST(COALESCE(AVG(qty),0) AS float)            AS cantidad,       -- ← PROMEDIO global
  CAST(COALESCE(AVG(1.0 * diff_sec),0) AS float) AS promedio_seg,
  CONVERT(varchar(8), DATEADD(SECOND, CAST(COALESCE(AVG(1.0 * diff_sec),0) AS int), 0), 108) AS promedio_hhmmss
FROM agg5_11

UNION ALL
SELECT
  N'5-11'                            AS tramo,
  N'DIA'                             AS nivel,
  fecha                              AS fecha,
  producto                           AS producto,
  CAST(NULL AS int)                  AS total_pares,
  CAST(SUM(qty) AS float)            AS cantidad,       -- ← SUMA por día+producto
  CAST(COALESCE(AVG(1.0 * diff_sec),0) AS float) AS promedio_seg,
  CONVERT(varchar(8), DATEADD(SECOND, CAST(COALESCE(AVG(1.0 * diff_sec),0) AS int), 0), 108) AS promedio_hhmmss
FROM agg5_11
GROUP BY fecha, producto

ORDER BY tramo, nivel, fecha, producto;
  `;

    const rows = await this.dataSource.query(sql, params);

    type Row = {
      tramo: '2-4' | '5-11';
      nivel: 'GLOBAL' | 'DIA';
      fecha: Date | string | null;
      producto: string | null;
      total_pares: number | null;   // GLOBAL
      cantidad: number | null;      // GLOBAL = promedio; DIA = suma
      promedio_seg: number;
      promedio_hhmmss: string;
    };

    const toYMD = (d: Date | string | null) =>
      typeof d === 'string' ? d.slice(0, 10) : (d ? new Date(d).toISOString().slice(0, 10) : null);

    const esperaGlobal = (rows as Row[]).find(r => r.tramo === '2-4' && r.nivel === 'GLOBAL') || null;
    const atencionGlobal = (rows as Row[]).find(r => r.tramo === '5-11' && r.nivel === 'GLOBAL') || null;

    const esperaDias = (rows as Row[])
      .filter(r => r.tramo === '2-4' && r.nivel === 'DIA')
      .map(r => ({
        fecha: toYMD(r.fecha)!,
        producto: r.producto,
        cantidad: r.cantidad ?? 0,               // SUMA por día+producto
        promedio_seg: r.promedio_seg,
        promedio_hhmmss: r.promedio_hhmmss,
      }));

    const atencionDias = (rows as Row[])
      .filter(r => r.tramo === '5-11' && r.nivel === 'DIA')
      .map(r => ({
        fecha: toYMD(r.fecha)!,
        producto: r.producto,
        cantidad: r.cantidad ?? 0,               // SUMA por día+producto
        promedio_seg: r.promedio_seg,
        promedio_hhmmss: r.promedio_hhmmss,
      }));

    return {
      Producto: product ?? null,
      Ingenio: ingenioId ?? null,
      ...(start || end
        ? { Rango: { Start: start?.toISOString() ?? null, End: end?.toISOString() ?? null } }
        : {}),
      PromedioEspera: {
        Global: {
          total_pares: esperaGlobal?.total_pares ?? 0,
          cantidad_promedio: esperaGlobal?.cantidad ?? 0,   // ← aquí exponemos el PROMEDIO
          promedio_seg: esperaGlobal?.promedio_seg ?? 0,
          promedio_hhmmss: esperaGlobal?.promedio_hhmmss ?? '00:00:00',
        },
        Dias: esperaDias,
      },
      PromedioAtencion: {
        Global: {
          total_pares: atencionGlobal?.total_pares ?? 0,
          cantidad_promedio: atencionGlobal?.cantidad ?? 0, // ← aquí exponemos el PROMEDIO
          promedio_seg: atencionGlobal?.promedio_seg ?? 0,
          promedio_hhmmss: atencionGlobal?.promedio_hhmmss ?? '00:00:00',
        },
        Dias: atencionDias,
      },
    };
  }



  async getPromediosAtencionDelDia(product?: string, ingenioId?: string) {
    await this.assertFilterValuesExist(product, ingenioId);

    const params: any[] = [];
    const addParam = (v: any) => { const i = params.length; params.push(v); return `@${i}`; };

    let filter24 = '';
    let filter5_11 = '';
    if (product) {
      filter24 += ` AND UPPER(LTRIM(RTRIM(sh.product)))    = UPPER(LTRIM(RTRIM(${addParam(product)})))`;
      filter5_11 += ` AND UPPER(LTRIM(RTRIM(sh.product)))    = UPPER(LTRIM(RTRIM(${addParam(product)})))`;
    }
    if (ingenioId) {
      filter24 += ` AND UPPER(LTRIM(RTRIM(sh.ingenio_id))) = UPPER(LTRIM(RTRIM(${addParam(ingenioId)})))`;
      filter5_11 += ` AND UPPER(LTRIM(RTRIM(sh.ingenio_id))) = UPPER(LTRIM(RTRIM(${addParam(ingenioId)})))`;
    }

    const sql = `
DECLARE @start DATETIME = CONVERT(date, GETDATE());
DECLARE @end   DATETIME = DATEADD(day, 1, @start);

WITH Horas AS (
  SELECT CAST(0 AS INT) AS h
  UNION ALL SELECT h + 1 FROM Horas WHERE h < 23
),

/* -------- PromedioEspera (2 -> 4) hoy -------- */
base24 AS (
  SELECT
    st.shipment_id,
    MIN(CASE WHEN st.predefined_status_id = 2 THEN st.created_at END) AS t2,
    MIN(CASE WHEN st.predefined_status_id = 4 THEN st.created_at END) AS t4
  FROM  Status st
  JOIN  Shipments sh ON sh.id = st.shipment_id
  WHERE st.predefined_status_id IN (2,4)
    ${filter24}
  GROUP BY st.shipment_id
  HAVING MIN(CASE WHEN st.predefined_status_id = 2 THEN st.created_at END) IS NOT NULL
     AND MIN(CASE WHEN st.predefined_status_id = 4 THEN st.created_at END) IS NOT NULL
     AND MIN(CASE WHEN st.predefined_status_id = 4 THEN st.created_at END)
         >= MIN(CASE WHEN st.predefined_status_id = 2 THEN st.created_at END)
     AND (MIN(CASE WHEN st.predefined_status_id = 4 THEN st.created_at END) >= @start)
     AND (MIN(CASE WHEN st.predefined_status_id = 4 THEN st.created_at END) <  @end)
),
agg24 AS (
  SELECT
    DATEDIFF(SECOND, t2, t4) AS diff_sec,
    DATEPART(HOUR, t4) AS h
  FROM base24
),
agg24H AS (
  SELECT h, COUNT(*) AS cantidad, AVG(1.0 * diff_sec) AS promedio_seg
  FROM agg24
  GROUP BY h
),

/* -------- PromedioAtencion (5 -> 11) hoy -------- */
base5_11 AS (
  SELECT
    st.shipment_id,
    MIN(CASE WHEN st.predefined_status_id = 5  THEN st.created_at END) AS t5,
    MIN(CASE WHEN st.predefined_status_id = 11 THEN st.created_at END) AS t11
  FROM  Status st
  JOIN  Shipments sh ON sh.id = st.shipment_id
  WHERE st.predefined_status_id IN (5,11)
    ${filter5_11}
  GROUP BY st.shipment_id
  HAVING MIN(CASE WHEN st.predefined_status_id = 5  THEN st.created_at END) IS NOT NULL
     AND MIN(CASE WHEN st.predefined_status_id = 11 THEN st.created_at END) IS NOT NULL
     AND MIN(CASE WHEN st.predefined_status_id = 11 THEN st.created_at END)
         >= MIN(CASE WHEN st.predefined_status_id = 5  THEN st.created_at END)
     AND (MIN(CASE WHEN st.predefined_status_id = 11 THEN st.created_at END) >= @start)
     AND (MIN(CASE WHEN st.predefined_status_id = 11 THEN st.created_at END) <  @end)
),
agg5_11 AS (
  SELECT
    DATEDIFF(SECOND, t5, t11) AS diff_sec,
    DATEPART(HOUR, t11) AS h
  FROM base5_11
),
agg5_11H AS (
  SELECT h, COUNT(*) AS cantidad, AVG(1.0 * diff_sec) AS promedio_seg
  FROM agg5_11
  GROUP BY h
)

SELECT
  CONVERT(varchar(19), @start, 126) AS [Rango.Start],
  CONVERT(varchar(19), @end,   126) AS [Rango.End],

  JSON_QUERY((
    SELECT
      JSON_QUERY((
        SELECT
          COUNT(*) AS total_pares,
          CAST(AVG(1.0 * diff_sec) AS float) AS promedio_seg,
          CASE WHEN COUNT(*) = 0 THEN NULL
               ELSE CONVERT(varchar(8), DATEADD(SECOND, CAST(AVG(1.0 * diff_sec) AS int), 0), 108)
          END AS promedio_hhmmss
        FROM agg24
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
      )) AS Espera,
      JSON_QUERY((
        SELECT
          COUNT(*) AS total_pares,
          CAST(AVG(1.0 * diff_sec) AS float) AS promedio_seg,
          CASE WHEN COUNT(*) = 0 THEN NULL
               ELSE CONVERT(varchar(8), DATEADD(SECOND, CAST(AVG(1.0 * diff_sec) AS int), 0), 108)
          END AS promedio_hhmmss
        FROM agg5_11
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
      )) AS Atencion
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
  )) AS [PromedioActual],

  JSON_QUERY((
    SELECT
      COUNT(*) AS total_pares,
      CAST(AVG(1.0 * diff_sec) AS float) AS promedio_seg,
      CASE WHEN COUNT(*) = 0 THEN NULL
           ELSE CONVERT(varchar(8), DATEADD(SECOND, CAST(AVG(1.0 * diff_sec) AS int), 0), 108)
      END AS promedio_hhmmss
    FROM agg24
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
  )) AS [PromedioEspera.Global],
  JSON_QUERY((
    SELECT
      RIGHT('0'+CAST(h.h AS varchar(2)),2)+':00' AS [Hora],
      ISNULL(a.cantidad, 0) AS cantidad,
      CAST(a.promedio_seg AS float) AS promedio_seg,
      CASE WHEN a.promedio_seg IS NULL THEN NULL
           ELSE CONVERT(varchar(8), DATEADD(SECOND, CAST(a.promedio_seg AS int), 0), 108)
      END AS promedio_hhmmss
    FROM Horas h
    LEFT JOIN agg24H a ON a.h = h.h
    ORDER BY h.h
    FOR JSON PATH
  )) AS [PromedioEspera.Horas],

  JSON_QUERY((
    SELECT
      COUNT(*) AS total_pares,
      CAST(AVG(1.0 * diff_sec) AS float) AS promedio_seg,
      CASE WHEN COUNT(*) = 0 THEN NULL
           ELSE CONVERT(varchar(8), DATEADD(SECOND, CAST(AVG(1.0 * diff_sec) AS int), 0), 108)
      END AS promedio_hhmmss
    FROM agg5_11
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
  )) AS [PromedioAtencion.Global],
  JSON_QUERY((
    SELECT
      RIGHT('0'+CAST(h.h AS varchar(2)),2)+':00' AS [Hora],
      ISNULL(a.cantidad, 0) AS cantidad,
      CAST(a.promedio_seg AS float) AS promedio_seg,
      CASE WHEN a.promedio_seg IS NULL THEN NULL
           ELSE CONVERT(varchar(8), DATEADD(SECOND, CAST(a.promedio_seg AS int), 0), 108)
      END AS promedio_hhmmss
    FROM Horas h
    LEFT JOIN agg5_11H a ON a.h = h.h
    ORDER BY h.h
    FOR JSON PATH
  )) AS [PromedioAtencion.Horas]
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
OPTION (MAXRECURSION 24);
`;

    const rows = await this.dataSource.query(sql, params);

    let data: any = {};
    if (rows && rows.length > 0) {
      const firstCell = Object.values(rows[0])[0];
      if (typeof firstCell === 'string') {
        try {
          data = JSON.parse(firstCell);
        } catch {
          try {
            const merged = rows.map(r => Object.values(r)[0]).join('');
            data = JSON.parse(merged || '{}');
          } catch (error) {
            console.error('⚠️ Error al parsear datos JSON del dashboard:', error.message);
            data = {}; // Valor por defecto si ambos parse fallan
          }
        }
      }
    }

    if (data?.['Rango.Start'] && data?.['Rango.End']) {
      data.Rango = { Start: data['Rango.Start'], End: data['Rango.End'] };
      delete data['Rango.Start']; delete data['Rango.End'];
    }

    return {
      Producto: product ?? null,
      Ingenio: ingenioId ?? null,
      ...data,
    };
  }

  private async assertFiltersExistForTimes(product?: string, ingenioId?: string) {
    if (product) {
      const r = await this.dataSource.query(
        `SELECT TOP 1 1 FROM  ShipmentsTimes WHERE UPPER(LTRIM(RTRIM(operation_type))) = UPPER(LTRIM(RTRIM(@0)))`,
        [product],
      );
      if (!r?.length) throw new BadRequestException(`Producto (operation_type) no válido: "${product}".`);
    }
    if (ingenioId) {
      const r = await this.dataSource.query(
        `SELECT TOP 1 1 FROM  Shipments WHERE UPPER(LTRIM(RTRIM(ingenio_id))) = UPPER(LTRIM(RTRIM(@0)))`,
        [ingenioId],
      );
      if (!r?.length) throw new BadRequestException(`Ingenio no válido: "${ingenioId}".`);
    }
  }

  async getPromedioDescargaHistorico(
    start?: Date,
    end?: Date,
    product?: string,
    ingenioId?: string,
  ) {
    const params: any[] = [];
    const add = (v: any) => { const i = params.length; params.push(v); return `@${i}`; };

    // Filtros basados en tu consulta
    let filtersNoDate = ''; // se aplican tanto para bounds como para datos
    if (product) filtersNoDate += ` AND UPPER(LTRIM(RTRIM(stt.operation_type))) = UPPER(LTRIM(RTRIM(${add(product)})))`;
    if (ingenioId) filtersNoDate += ` AND UPPER(LTRIM(RTRIM(sh.ingenio_id)))     = UPPER(LTRIM(RTRIM(${add(ingenioId)})))`;

    const sParam = start ? add(start) : 'NULL';
    const eParam = end ? add(end) : 'NULL';

    const sql = `
/* 1) Filas "base" (tu consulta) + mapeo truck_type + TIME -> seg */
WITH RowsNoDate AS (
  SELECT
    CAST(stt.created_at AS date) AS fecha,
    DATEDIFF(SECOND, CAST('00:00:00' AS time), stt.[time]) AS tiempo_seg,
    CASE
      WHEN UPPER(LTRIM(RTRIM(stt.truck_type))) = 'R' THEN 'Planas'  -- leyenda
      WHEN UPPER(LTRIM(RTRIM(stt.truck_type))) = 'V' THEN 'Volteo'
      WHEN UPPER(LTRIM(RTRIM(stt.truck_type))) = 'P' THEN 'Pipa'
      ELSE 'Otro'
    END AS truckCat
  FROM  ShipmentsTimes stt
  JOIN  Shipments      sh  ON sh.id = stt.shipment_id
  WHERE 1=1
    ${filtersNoDate}
),
Bounds AS ( SELECT MIN(fecha) AS minF, MAX(fecha) AS maxF FROM RowsNoDate ),
Params AS (
  SELECT CAST(${sParam} AS date) AS s0, CAST(${eParam} AS date) AS e0, minF, maxF FROM Bounds
),
/* 2) Rango efectivo: usa start/end si vienen; si faltan, usa bounds de tabla (end = max + 1 día) */
Rango AS (
  SELECT
    CASE WHEN s0 IS NOT NULL THEN s0 ELSE minF END AS dStart,
    CASE WHEN e0 IS NOT NULL THEN e0 ELSE DATEADD(day, 1, maxF) END AS dEnd
  FROM Params
),
/* 3) Generador de días del rango */
Nums(n) AS (
  SELECT 0 UNION ALL
  SELECT n+1 FROM Nums JOIN Rango r ON n+1 < DATEDIFF(DAY, r.dStart, r.dEnd)
),
Dias AS (
  SELECT DATEADD(day, n, r.dStart) AS fecha
  FROM Nums JOIN Rango r ON 1=1
),
/* 4) Filas del rango por DATE (evita problemas de hora/UTC) */
RowsInRange AS (
  SELECT r.* FROM RowsNoDate r
  JOIN Rango rg ON r.fecha >= rg.dStart AND r.fecha < rg.dEnd
),
/* 5) Agregados por día */
Agg AS (
  SELECT
    fecha,
    COUNT(*) AS total,
    AVG(CASE WHEN truckCat = 'Planas' THEN 1.0 * tiempo_seg END) AS avg_planas,
    AVG(CASE WHEN truckCat = 'Volteo' THEN 1.0 * tiempo_seg END) AS avg_volteo,
    AVG(CASE WHEN truckCat = 'Pipa'   THEN 1.0 * tiempo_seg END) AS avg_pipa
  FROM RowsInRange
  GROUP BY fecha
)
/* 6) Resultado por día (una fila por cada fecha del rango) */
SELECT
  CONVERT(varchar(19), CAST((SELECT dStart FROM Rango) AS datetime), 126) AS start_iso,
  CONVERT(varchar(19), CAST((SELECT dEnd   FROM Rango) AS datetime), 126) AS end_iso,
  FORMAT(d.fecha, 'dd-MM-yy') AS fecha_txt,
  ISNULL(a.total, 0)          AS total,
  CAST(a.avg_planas AS float) AS avg_planas,
  CAST(a.avg_volteo AS float) AS avg_volteo,
  CAST(a.avg_pipa   AS float) AS avg_pipa
FROM Dias d
LEFT JOIN Agg a ON a.fecha = d.fecha
ORDER BY d.fecha
OPTION (MAXRECURSION 0);
`;

    const rows: Array<{
      start_iso: string | null;
      end_iso: string | null;
      fecha_txt: string;
      total: number;
      avg_planas: number | null;
      avg_volteo: number | null;
      avg_pipa: number | null;
    }> = await this.dataSource.query(sql, params);

    // Si no hay datos (p.ej. tabla vacía y no enviaste rango), devolvemos shape vacío
    if (!rows || rows.length === 0 || (!rows[0].start_iso && !rows[0].end_iso)) {
      return {
        Producto: product ?? null,
        Ingenio: ingenioId ?? null,
        PromedioDescarga: { Total: 0, Dias: [] }
      };
    }

    const startIso = rows[0].start_iso;
    const endIso = rows[0].end_iso;

    const dias = rows.map(r => ({
      Fecha: r.fecha_txt,
      Total: r.total ?? 0,
      TruckType: {
        Planas: secToHHMMSS(r.avg_planas),
        Volteo: secToHHMMSS(r.avg_volteo),
        Pipa: secToHHMMSS(r.avg_pipa),
      }
    }));

    const totalGlobal = dias.reduce((acc, d) => acc + (d.Total || 0), 0);

    return {
      Producto: product ?? null,
      Ingenio: ingenioId ?? null,
      ...(startIso || endIso ? { Rango: { Start: startIso, End: endIso } } : {}),
      PromedioDescarga: { Total: totalGlobal, Dias: dias }
    };
  }

  async getPromedioDescargaDelDia(product?: string, ingenioId?: string) {
    const params: any[] = [];
    const add = (v: any) => { const i = params.length; params.push(v); return `@${i}`; };

    // Filtros opcionales (case-insensitive, trim)
    let where = '';
    if (product) where += ` AND UPPER(LTRIM(RTRIM(stt.operation_type))) = UPPER(LTRIM(RTRIM(${add(product)})))`;
    if (ingenioId) where += ` AND UPPER(LTRIM(RTRIM(sh.ingenio_id)))     = UPPER(LTRIM(RTRIM(${add(ingenioId)})))`;

    const sql = `
DECLARE @start DATETIME = CONVERT(date, GETDATE());
DECLARE @end   DATETIME = DATEADD(day, 1, @start);

WITH Horas AS (
  SELECT CAST(0 AS INT) AS h
  UNION ALL SELECT h + 1 FROM Horas WHERE h < 23
),
Base AS (
  SELECT
    DATEPART(HOUR, stt.created_at) AS h,
    -- Convierte TIME a segundos
    DATEDIFF(SECOND, CAST('00:00:00' AS time), stt.[time]) AS tiempo_seg,
    CASE
      WHEN UPPER(LTRIM(RTRIM(stt.truck_type))) = 'R' THEN 'Planas'
      WHEN UPPER(LTRIM(RTRIM(stt.truck_type))) = 'V' THEN 'Volteo'
      WHEN UPPER(LTRIM(RTRIM(stt.truck_type))) = 'P' THEN 'Pipa'
      ELSE 'Otro'
    END AS truckCat
  FROM  ShipmentsTimes stt
  JOIN  Shipments      sh  ON sh.id = stt.shipment_id
  WHERE stt.created_at >= @start AND stt.created_at < @end
    ${where}
),
AggH AS (
  SELECT
    h,
    COUNT(*) AS total,
    AVG(CASE WHEN truckCat = 'Planas' THEN 1.0 * tiempo_seg END) AS avg_planas,
    AVG(CASE WHEN truckCat = 'Volteo' THEN 1.0 * tiempo_seg END) AS avg_volteo,
    AVG(CASE WHEN truckCat = 'Pipa'   THEN 1.0 * tiempo_seg END) AS avg_pipa
  FROM Base
  GROUP BY h
),
AggGlobal AS (
  SELECT
    COUNT(*) AS total,
    AVG(CASE WHEN truckCat = 'Planas' THEN 1.0 * tiempo_seg END) AS avg_planas,
    AVG(CASE WHEN truckCat = 'Volteo' THEN 1.0 * tiempo_seg END) AS avg_volteo,
    AVG(CASE WHEN truckCat = 'Pipa'   THEN 1.0 * tiempo_seg END) AS avg_pipa
  FROM Base
)
SELECT
  CONVERT(varchar(19), @start, 126) AS start_iso,
  CONVERT(varchar(19), @end,   126) AS end_iso,
  h.h AS hour_bucket,
  ISNULL(a.total, 0)          AS total_hour,
  CAST(a.avg_planas AS float) AS avg_planas,
  CAST(a.avg_volteo AS float) AS avg_volteo,
  CAST(a.avg_pipa   AS float) AS avg_pipa,
  -- los siguientes 4 vienen iguales en cada fila (tomamos el primero en Node)
  (SELECT total      FROM AggGlobal)          AS g_total,
  CAST((SELECT avg_planas FROM AggGlobal) AS float) AS g_planas,
  CAST((SELECT avg_volteo FROM AggGlobal) AS float) AS g_volteo,
  CAST((SELECT avg_pipa   FROM AggGlobal) AS float) AS g_pipa
FROM Horas h
LEFT JOIN AggH a ON a.h = h.h
ORDER BY h.h
OPTION (MAXRECURSION 24);
`;

    const rows: Array<{
      start_iso: string;
      end_iso: string;
      hour_bucket: number;
      total_hour: number;
      avg_planas: number | null;
      avg_volteo: number | null;
      avg_pipa: number | null;
      g_total: number | null;
      g_planas: number | null;
      g_volteo: number | null;
      g_pipa: number | null;
    }> = await this.dataSource.query(sql, params);

    // Armar respuesta
    const rangoStart = rows[0]?.start_iso ?? null;
    const rangoEnd = rows[0]?.end_iso ?? null;

    const horas = rows.map(r => ({
      Hora: `${r.hour_bucket.toString().padStart(2, '0')}:00`,
      Total: r.total_hour ?? 0,
      TruckType: {
        Planas: secToHHMMSS(r.avg_planas),
        Volteo: secToHHMMSS(r.avg_volteo),
        Pipa: secToHHMMSS(r.avg_pipa),
      }
    }));

    // Totales y promedios globales (día)
    const totalGlobal = rows[0]?.g_total ?? horas.reduce((acc, h) => acc + (h.Total || 0), 0);
    const promedioActual = {
      Planas: secToHHMMSS(rows[0]?.g_planas ?? null),
      Volteo: secToHHMMSS(rows[0]?.g_volteo ?? null),
      Pipa: secToHHMMSS(rows[0]?.g_pipa ?? null),
    };

    return {
      Producto: product ?? null,
      Ingenio: ingenioId ?? null,
      Rango: { Start: rangoStart, End: rangoEnd },
      PromedioDescarga: {
        Total: totalGlobal ?? 0,
        PromedioActual: promedioActual,
        Horas: horas
      }
    };
  }

  async getPesosPorStatusPromedioDiario(
    start: Date | undefined,
    end: Date | undefined,
    product: string | undefined,
    ingenioId: string | undefined,
    minStatus: number = 9, // >= 9 equivale a > 8
  ) {
    const params: any[] = [];
    const add = (v: any) => { const i = params.length; params.push(v); return `@${i}`; };

    // WHERE dinámico (el orden de add(...) = orden real de params)
    let where = 'WHERE 1=1';
    where += ` AND st.predefined_status_id >= ${add(minStatus)}`;
    if (product) where += ` AND UPPER(LTRIM(RTRIM(sh.product)))    = UPPER(LTRIM(RTRIM(${add(product)})))`;
    if (ingenioId) where += ` AND UPPER(LTRIM(RTRIM(sh.ingenio_id))) = UPPER(LTRIM(RTRIM(${add(ingenioId)})))`;
    if (start) where += ` AND st.created_at >= ${add(start)}`;
    if (end) where += ` AND st.created_at <  ${add(end)}`;

    const sql = `
SELECT
  FORMAT(CAST(st.created_at AS date), 'dd-MM-yy') AS fecha_txt,
  COUNT(*) AS total_registros,
  /* Convertimos a TONELADAS (kg / 1000) */
  CAST(SUM(CAST(sh.product_quantity_kg AS float)) AS float) / 1000.0 AS total_ton,
  LTRIM(RTRIM(sh.product)) AS Product            -- ⬅️ alias consistente para el frontend
FROM  Shipments sh
JOIN  Status    st ON st.shipment_id = sh.id
${where}
GROUP BY CAST(st.created_at AS date), LTRIM(RTRIM(sh.product))
ORDER BY CAST(st.created_at AS date);
`;

    type Row = {
      fecha_txt: string;
      total_registros: number;
      total_ton: number;
      Product: string;              // ⬅️ viene con este alias
    };

    const rows: Row[] = await this.dataSource.query(sql, params);

    // Construye "Dias" con Producto incluido (múltiples filas por fecha si hay varios productos)
    const Dias = rows.map(r => ({
      Fecha: r.fecha_txt,
      Product: r.Product,                     // ⬅️ ahora se incluye
      TotalRegistros: r.total_registros ?? 0,
      TotalKg: r.total_ton ?? 0,              // en toneladas (mantengo el nombre TotalKg para no romper el frontend)
    }));

    // Totales globales
    const totalRegistros = rows.reduce((acc, r) => acc + (r.total_registros || 0), 0);

    // Promedio diario correcto: sumar por fecha (independiente del producto) y luego promediar
    const tonPorDia = new Map<string, number>();
    for (const r of rows) {
      tonPorDia.set(r.fecha_txt, (tonPorDia.get(r.fecha_txt) ?? 0) + (r.total_ton || 0));
    }
    const daysCount = tonPorDia.size;
    const sumTonByDay = Array.from(tonPorDia.values()).reduce((a, b) => a + b, 0);
    const promedioTon = daysCount > 0 ? sumTonByDay / daysCount : 0;

    // Eco de rango (solo si lo enviaste)
    const rango = (start || end)
      ? { Start: start?.toISOString().slice(0, 19), End: end?.toISOString().slice(0, 19) }
      : undefined;

    return {
      Producto: product ?? null,
      Ingenio: ingenioId ?? null,
      ...(rango ? { Rango: rango } : {}),
      PesosPorStatus: {
        TotalRegistros: totalRegistros,
        TotalKg: promedioTon,   // promedio diario en TONELADAS
        Dias
      }
    };
  }

  async getPesosPorStatusDelDia(
    product: string | undefined,
    ingenioId: string | undefined,
    minStatus: number = 9,
    from?: Date,   // opcional: si no llegan -> hoy 00:00
    to?: Date      // opcional: si no llegan -> mañana 00:00
  ) {
    // 0) Rango por defecto si no vienen (hoy 00:00 → mañana 00:00)
    const base = new Date(); base.setHours(0, 0, 0, 0);
    const fromLocal = from ?? base;
    const toLocal = to ?? new Date(base.getTime() + 24 * 60 * 60 * 1000);
    if (!(toLocal > fromLocal)) throw new Error('Rango inválido: "from" debe ser < "to".');

    const params: any[] = [];
    const add = (v: any) => { const i = params.length; params.push(v); return `@${i}`; };

    const pStart = add(fromLocal);
    const pEnd = add(toLocal);
    const pMin = add(minStatus);

    let filterIng = '';
    if (ingenioId) filterIng += ` AND UPPER(LTRIM(RTRIM(sh.ingenio_id))) = UPPER(LTRIM(RTRIM(${add(ingenioId)})))`;

    const productParamSql = product ? `UPPER(LTRIM(RTRIM(${add(product)})))` : `NULL`;

    const sql = `
;WITH Params AS (
  SELECT CAST(${pStart} AS DATETIME) AS start_dt,
         CAST(${pEnd}   AS DATETIME) AS end_dt
),
Bounds AS (
  SELECT
    DATEPART(HOUR, p.start_dt) AS h_start,
    DATEPART(HOUR, DATEADD(SECOND, -1, p.end_dt)) AS h_end_incl,
    p.start_dt, p.end_dt
  FROM Params p
),
Horas AS (
  SELECT b.h_start AS h FROM Bounds b
  UNION ALL
  SELECT h + 1 FROM Horas, Bounds b WHERE h < b.h_end_incl
),
-- Último status por envío dentro del rango (evita contar un mismo envío varias veces)
LastSt AS (
  SELECT
    st.shipment_id,
    st.predefined_status_id,
    st.created_at,
    ROW_NUMBER() OVER (PARTITION BY st.shipment_id ORDER BY st.created_at DESC) AS rn
  FROM Status st
  JOIN Shipments sh ON sh.id = st.shipment_id
  CROSS JOIN Params p
  WHERE st.created_at >= p.start_dt
    AND st.created_at <  p.end_dt
    ${filterIng}
),
BaseSource AS (
  SELECT
    DATEPART(HOUR, ls.created_at) AS h,
    UPPER(LTRIM(RTRIM(sh.product))) AS product,
    1 AS uno,
    CAST(sh.product_quantity_kg AS float) AS kg   -- << KG reales
  FROM LastSt ls
  JOIN Shipments sh ON sh.id = ls.shipment_id
  WHERE ls.rn = 1
    AND ls.predefined_status_id >= ${pMin}
),
Products AS (
  ${product
        ? `SELECT ${productParamSql} AS product`
        : `SELECT product FROM BaseSource GROUP BY product`
      }
),
Base AS (
  SELECT bs.h, bs.product, bs.uno, bs.kg
  FROM BaseSource bs
  ${product ? `WHERE bs.product = (SELECT TOP 1 product FROM Products)` : ``}
),
AggH_Prod AS (
  SELECT
    h, product,
    SUM(uno) AS total_registros_hp,
    SUM(kg)  AS total_kg_hp
  FROM Base
  GROUP BY h, product
),
AggGlobal AS (
  SELECT
    SUM(uno) AS g_registros,
    SUM(kg)  AS g_kg
  FROM Base
)
SELECT
  CONVERT(varchar(19), b.start_dt, 126) AS start_iso,
  CONVERT(varchar(19), b.end_dt,   126) AS end_iso,
  (b.h_end_incl - b.h_start + 1)        AS hours_count,
  ISNULL((SELECT g_registros FROM AggGlobal), 0)       AS g_registros,
  CAST(ISNULL((SELECT g_kg FROM AggGlobal), 0) AS float) AS g_kg,
  H.h AS hour_bucket,
  P.product,
  ISNULL(A.total_registros_hp, 0)               AS total_registros,
  CAST(ISNULL(A.total_kg_hp, 0) AS float)       AS total_kg
FROM Horas H
CROSS JOIN Bounds b
CROSS JOIN Products P
LEFT JOIN AggH_Prod A
  ON A.h = H.h AND A.product = P.product
ORDER BY H.h, P.product
OPTION (MAXRECURSION 32767);
`;

    type Row = {
      start_iso: string;
      end_iso: string;
      hours_count: number;
      g_registros: number;
      g_kg: number;
      hour_bucket: number;
      product: string | null;
      total_registros: number | null;
      total_kg: number | null;
    };

    const rows: Row[] = await this.dataSource.query(sql, params);

    const rangoStart = rows[0]?.start_iso ?? fromLocal.toISOString().slice(0, 19);
    const rangoEnd = rows[0]?.end_iso ?? toLocal.toISOString().slice(0, 19);
    const hoursCount = rows[0]?.hours_count ?? Math.max(1, Math.ceil((toLocal.getTime() - fromLocal.getTime()) / 3600000));

    const totalRegistros = rows.length ? (rows[0].g_registros ?? 0) : 0;
    const totalKg = rows.length ? (rows[0].g_kg ?? 0) : 0;

    // Promedios globales
    const avgKgPorRegistro = totalRegistros > 0 ? totalKg / totalRegistros : 0;   // kg/registro
    const avgKgPorHora = hoursCount > 0 ? totalKg / hoursCount : 0;     // kg/hora
    const avgRegPorHora = hoursCount > 0 ? totalRegistros / hoursCount : 0;  // registros/hora

    // Buckets de horas dentro del rango (Hora, Product, Totales y promedio por registro)
    const horas = rows.map(r => {
      const tr = r.total_registros ?? 0;
      const tk = r.total_kg ?? 0;
      const avgKgPorReg = tr > 0 ? tk / tr : 0;
      return {
        Hora: `${r.hour_bucket.toString().padStart(2, '0')}:00`,
        Product: r.product,
        TotalRegistros: tr,
        TotalKg: tk,
        AvgKgPorRegistro: avgKgPorReg
      };
    });

    return {
      Producto: product ?? null,
      Ingenio: ingenioId ?? null,
      Rango: { Start: rangoStart, End: rangoEnd },

      PesosPorStatus: {
        // Totales del rango
        TotalRegistros: totalRegistros,
        TotalKg: totalKg,

        // Promedios del rango (lo que pediste)
        Promedios: {
          KgPorRegistro: avgKgPorRegistro,  // promedio despachado por número de registros (kg/registro)
          KgPorHora: avgKgPorHora,      // promedio despachado por horas del rango (kg/h)
          RegistrosPorHora: avgRegPorHora   // promedio de registros por hora
        },

        // Detalle por hora (incluye promedio por registro por bucket)
        Horas: horas
      }
    };
  }

  async getTiemposDelDiaDetallado(
    product: string | undefined,
    ingenioId: string | undefined,
    hStart: number, // 0..23
    hEnd: number,   // 0..23
  ) {
    const params: any[] = [];
    const add = (v: any) => { const i = params.length; params.push(v); return `@${i}`; };

    // Filtros case-insensitive sobre Shipments
    let filterShip = '';
    if (product) filterShip += ` AND UPPER(LTRIM(RTRIM(sh.product)))    = UPPER(LTRIM(RTRIM(${add(product)})))`;
    if (ingenioId) filterShip += ` AND UPPER(LTRIM(RTRIM(sh.ingenio_id))) = UPPER(LTRIM(RTRIM(${add(ingenioId)})))`;

    // --- RANGO DEL DÍA (desde SQL Server para usar su reloj) ---
    const rangeRow = await this.dataSource.query(`
    DECLARE @start DATETIME = CONVERT(date, GETDATE());
    SELECT
      CONVERT(varchar(19), @start, 126)                            AS start_iso,
      CONVERT(varchar(19), DATEADD(day, 1, @start), 126)           AS end_iso;
  `);
    const rangoStart = rangeRow?.[0]?.start_iso ?? null;
    const rangoEnd = rangeRow?.[0]?.end_iso ?? null;

    // ---------------- TRANSITO A PLANTA (4 -> 5 HOY) ----------------
    const sqlTransito = `
DECLARE @start DATETIME = CONVERT(date, GETDATE());
DECLARE @end   DATETIME = DATEADD(day, 1, @start);
DECLARE @hStart INT = ${add(hStart)};
DECLARE @hEnd   INT = ${add(hEnd)};

WITH Sh AS (
  SELECT sh.id, sh.ingenio_id, sh.product, v.truck_type, v.trailer_plate
  FROM  Shipments sh
  JOIN  Vehicles  v ON v.id = sh.vehicle_id
  WHERE 1=1 ${filterShip}
),
S5 AS (
  SELECT st5.shipment_id, st5.created_at AS t5
  FROM  Status st5
  JOIN Sh ON Sh.id = st5.shipment_id
  WHERE st5.predefined_status_id = 5
    AND st5.created_at >= @start AND st5.created_at < @end
    AND DATEPART(HOUR, st5.created_at) BETWEEN @hStart AND @hEnd
),
Pairs AS (
  SELECT
    s.id                                AS shipment_id,
    s.ingenio_id,
    s.product,
    s.truck_type,
    s.trailer_plate,
    s5.t5                                AS t5,
    (
      SELECT TOP (1) st4.created_at
      FROM  Status st4
      WHERE st4.shipment_id = s.id
        AND st4.predefined_status_id = 4
        AND st4.created_at <= s5.t5
      ORDER BY st4.created_at DESC
    )                                    AS t4
  FROM Sh s
  JOIN S5 s5 ON s5.shipment_id = s.id
)
SELECT
  p.shipment_id         AS ShipmentId,
  p.ingenio_id          AS IngenioId,
  p.product             AS Product,
  p.truck_type          AS TruckType,
  p.trailer_plate       AS Placa,
  p.t5                  AS Fecha,
  DATEPART(HOUR, p.t5)  AS H,
  DATEDIFF(SECOND, p.t4, p.t5) AS DiffSec
FROM Pairs p
WHERE p.t4 IS NOT NULL
ORDER BY Fecha;`;

    type TRow = {
      ShipmentId: number; IngenioId: string; Product: string;
      TruckType: string; Placa: string; Fecha: string; H: number; DiffSec: number;
    };
    const transRows: TRow[] = await this.dataSource.query(sqlTransito, params);
    const transFilas = transRows.map(r => ({
      ShipmentId: r.ShipmentId,
      IngenioId: r.IngenioId,
      Product: r.Product,
      TruckType: r.TruckType,
      PlacaRemolque: r.Placa,
      Fecha: r.Fecha,
      Hora: `${r.H.toString().padStart(2, '0')}:00`,
      Tiempo: this.secToHHMMSS(r.DiffSec),
    }));
    const transPromSec = transRows.length ? transRows.reduce((a, r) => a + r.DiffSec, 0) / transRows.length : 0;
    const transProm = this.secToHHMMSS(transPromSec);

    // Promedios por producto y tipo de camión (Transito)
    const groupKey = (p: string, t: string) => `${(p || '').toUpperCase()}|${(t || '').toUpperCase()}`;
    const aggProm = (rows: TRow[]) => {
      const map = new Map<string, { p: string, t: string, sum: number, cnt: number }>();
      for (const r of rows) {
        const k = groupKey(r.Product, r.TruckType);
        if (!map.has(k)) map.set(k, { p: r.Product, t: r.TruckType, sum: 0, cnt: 0 });
        const o = map.get(k)!; o.sum += r.DiffSec; o.cnt++;
      }
      return [...map.values()].map(o => ({
        Product: o.p,
        TruckType: o.t,
        PromedioHHMMSS: this.secToHHMMSS(o.sum / o.cnt),
        TotalRegistros: o.cnt
      }));
    };
    const transPromPT = aggProm(transRows);

    // Promedios Azúcar/Melaza (Transito)
    const avgFor = (rows: TRow[], productCode: string) => {
      const f = rows.filter(r => (r.Product || '').toUpperCase() === productCode.toUpperCase());
      const s = f.length ? f.reduce((a, r) => a + r.DiffSec, 0) / f.length : 0;
      return this.secToHHMMSS(s);
    };
    const PromedioAzucar = avgFor(transRows, 'AZ-001');
    const PromedioMelaza = avgFor(transRows, 'MEL-001');

    // ------------------- TIEMPO EN COLA (7 -> 8 HOY) -------------------
    const sqlCola = `
DECLARE @start DATETIME = CONVERT(date, GETDATE());
DECLARE @end   DATETIME = DATEADD(day, 1, @start);
DECLARE @hStart INT = ${add(hStart)};
DECLARE @hEnd   INT = ${add(hEnd)};

WITH Sh AS (
  SELECT sh.id, sh.ingenio_id, sh.product, v.truck_type, v.trailer_plate
  FROM  Shipments sh
  JOIN  Vehicles  v ON v.id = sh.vehicle_id
  WHERE 1=1 ${filterShip}
),
S8 AS (
  SELECT st8.shipment_id, st8.created_at AS t8
  FROM  Status st8
  JOIN Sh ON Sh.id = st8.shipment_id
  WHERE st8.predefined_status_id = 8
    AND st8.created_at >= @start AND st8.created_at < @end
    AND DATEPART(HOUR, st8.created_at) BETWEEN @hStart AND @hEnd
),
Pairs AS (
  SELECT
    s.id                                AS shipment_id,
    s.ingenio_id,
    s.product,
    s.truck_type,
    s.trailer_plate,
    s8.t8                                AS t8,
    (
      SELECT TOP (1) st7.created_at
      FROM  Status st7
      WHERE st7.shipment_id = s.id
        AND st7.predefined_status_id = 7
        AND st7.created_at <= s8.t8
      ORDER BY st7.created_at DESC
    )                                    AS t7
  FROM Sh s
  JOIN S8 s8 ON s8.shipment_id = s.id
)
SELECT
  p.shipment_id         AS ShipmentId,
  p.ingenio_id          AS IngenioId,
  p.product             AS Product,
  p.truck_type          AS TruckType,
  p.trailer_plate       AS Placa,
  p.t8                  AS Fecha,
  DATEPART(HOUR, p.t8)  AS H,
  DATEDIFF(SECOND, p.t7, p.t8) AS DiffSec
FROM Pairs p
WHERE p.t7 IS NOT NULL
ORDER BY Fecha;`;

    const colaRows: TRow[] = await this.dataSource.query(sqlCola, params);
    const colaFilas = colaRows.map(r => ({
      ShipmentId: r.ShipmentId,
      IngenioId: r.IngenioId,
      Product: r.Product,
      TruckType: r.TruckType,
      PlacaRemolque: r.Placa,
      Fecha: r.Fecha,
      Hora: `${r.H.toString().padStart(2, '0')}:00`,
      Tiempo: this.secToHHMMSS(r.DiffSec),
    }));
    const colaPromSec = colaRows.length ? colaRows.reduce((a, r) => a + r.DiffSec, 0) / colaRows.length : 0;
    const colaProm = this.secToHHMMSS(colaPromSec);
    const colaPromPT = aggProm(colaRows);

    // Promedios por tipo de camión (Plana/Volteo/Pipa) para TiempoEnCola
    const avgTruck = (rows: TRow[], type: string | string[]) => {
      const types = Array.isArray(type) ? type.map(t => t.toUpperCase()) : [type.toUpperCase()];
      const f = rows.filter(r => types.includes((r.TruckType || '').toUpperCase()));
      const s = f.length ? f.reduce((a, r) => a + r.DiffSec, 0) / f.length : 0;
      return this.secToHHMMSS(s);
    };
    const PromedioPlana = avgTruck(colaRows, ['PLANA', 'R']);
    const PromedioVolteo = avgTruck(colaRows, ['VOLTEO', 'V']);
    const PromedioPipa = avgTruck(colaRows, ['PIPA', 'P']);

    // -------------------------- DESCARGA (ShipmentsTimes) --------------------------
    const sqlDescarga = `
DECLARE @start DATETIME = CONVERT(date, GETDATE());
DECLARE @end   DATETIME = DATEADD(day, 1, @start);
DECLARE @hStart INT = ${add(hStart)};
DECLARE @hEnd   INT = ${add(hEnd)};

SELECT
  sh.id                        AS ShipmentId,
  sh.ingenio_id                AS IngenioId,
  sh.product                   AS Product,
  v.truck_type                 AS TruckType,
  v.trailer_plate              AS Placa,
  stt.created_at               AS Fecha,
  DATEPART(HOUR, stt.created_at) AS H,
  DATEDIFF(SECOND, CAST('00:00:00' AS time), stt.[time]) AS DiffSec
FROM  ShipmentsTimes stt
JOIN  Shipments     sh  ON sh.id = stt.shipment_id
JOIN  Vehicles      v   ON v.id = sh.vehicle_id
WHERE stt.created_at >= @start AND stt.created_at < @end
  AND DATEPART(HOUR, stt.created_at) BETWEEN @hStart AND @hEnd
  ${filterShip}
ORDER BY Fecha;`;

    const descRows: TRow[] = await this.dataSource.query(sqlDescarga, params);
    const descFilas = descRows.map(r => ({
      ShipmentId: r.ShipmentId,
      IngenioId: r.IngenioId,
      PlacaRemolque: r.Placa,
      OperationType: r.Product,        // alias como en tu ejemplo
      TruckType: r.TruckType,
      Fecha: r.Fecha,
      Hora: `${r.H.toString().padStart(2, '0')}:00`,
      Tiempo: this.secToHHMMSS(r.DiffSec),
    }));
    const descPromSec = descRows.length ? descRows.reduce((a, r) => a + r.DiffSec, 0) / descRows.length : 0;
    const descProm = this.secToHHMMSS(descPromSec);
    const descPromPT = aggProm(descRows);

    // Promedios por tipo de camión para Descarga
    const dPromPlana = avgTruck(descRows, ['PLANA', 'R']);
    const dPromVolteo = avgTruck(descRows, ['VOLTEO', 'V']);
    const dPromPipa = avgTruck(descRows, ['PIPA', 'P']);

    // -------------------------- UnidadesDespachadasPorHora --------------------------
    // Reutilizamos descRows (cada registro = 1 unidad). Totales por tipo:
    const totalTipo = (types: string | string[]) => {
      const ts = Array.isArray(types) ? types.map(t => t.toUpperCase()) : [types.toUpperCase()];
      return descRows.filter(r => ts.includes((r.TruckType || '').toUpperCase())).length;
    };
    const unidadesHoras = descRows.map(r => ({
      Hora: `${r.H.toString().padStart(2, '0')}:00`,
      ShipmentId: r.ShipmentId,
      IngenioId: r.IngenioId,
      Product: r.Product,
      TruckType: r.TruckType,
      PlacaRemolque: r.Placa,
      Fecha: r.Fecha,
      Total: 1
    }));

    // -------------------------- RESPUESTA FINAL --------------------------
    return {
      Rango: { Start: rangoStart, End: rangoEnd },
      FiltroHoras: { Start: hStart, End: hEnd },

      TransitoAPlanta: {
        TotalRegistros: transFilas.length,
        PromedioHHMMSS: transProm,
        PromedioAzucar,
        PromedioMelaza,
        Filas: transFilas,
        PromedioPorProductoYTipoCamion: transPromPT,
      },

      TiempoEnCola: {
        TotalRegistros: colaFilas.length,
        PromedioHHMMSS: colaProm,
        PromedioPlana,
        PromedioVolteo,
        PromedioPipa,
        Filas: colaFilas,
        PromedioPorProductoYTipoCamion: colaPromPT,
      },

      Descarga: {
        TotalRegistros: descFilas.length,
        PromedioHHMMSS: descProm,
        PromedioPlana: dPromPlana,
        PromedioVolteo: dPromVolteo,
        PromedioPipa: dPromPipa,
        Filas: descFilas,
        PromedioPorProductoYTipoCamion: descPromPT,
      },

      UnidadesDespachadasPorHora: {
        TotalRegistros: unidadesHoras.length,
        TotalRegistrosPlana: totalTipo(['PLANA', 'R']),
        TotalRegistrosVolteo: totalTipo(['VOLTEO', 'V']),
        TotalRegistrosPipa: totalTipo(['PIPA', 'P']),
        Horas: unidadesHoras
      }
    };
  }

  // helper local (mismo archivo/service)
  private secToHHMMSS(totalSec?: number | null): string {
    const sec = Math.max(0, Math.floor(totalSec ?? 0));
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
}