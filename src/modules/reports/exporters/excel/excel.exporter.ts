import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

type TruckEntryRow = {
  shipment_id: number;
  codigo_generacion: string;
  fechayhora_ingreso: any;
  fechayhora_salida: any;
  motorista: string;
  licencia: string;
  placa_cabezal: string;
  placa_remolque: string;
  transportista: string;
};

type RequiresSweepingRow = {
  ingenio: string;
  codigo_generacion: string;
  id_nav: string | number;
  licencia: string;
  motorista: string;
  placa_cabezal: string;
  placa_remolque: string;
  solicito_barrido: string; // SI/NO
  tipo_barrido: string; // COMPLETO/SENCILLO
  fecha_prechequeo: any;
  fecha_entrada_planta: any;
  fecha_salida_planta: any;
};

@Injectable()
export class ExcelExporter {
  private toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  private addLogo(workbook: ExcelJS.Workbook, ws: ExcelJS.Worksheet) {
    const logoPath = path.join(
      process.cwd(),
      'src',
      'assets',
      'almepac-logo.png',
    );
    if (!fs.existsSync(logoPath)) return;

    const imageId = workbook.addImage({
      filename: logoPath,
      extension: 'png',
    });

    // Ubicar logo en el rango I3:J5 (como tu diseño)
    ws.addImage(imageId, {
      tl: { col: 8.05, row: 2.1 }, // I3 approx
      ext: { width: 250, height: 70 },
    });
  }

  private setBorder(cell: ExcelJS.Cell) {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  private colLetter(n: number) {
    // 1 -> A
    let s = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  async buildTruckEntryWorkbook(params: {
    rows: TruckEntryRow[];
    meta?: Record<string, any>;
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ingenioapi';
    wb.created = new Date();

    const ws = wb.addWorksheet('Ingreso de camiones', {
      views: [{ state: 'frozen', ySplit: 6 }], // congela hasta fila 6 (headers en 6)
    });

    // Columnas B..J según tu screenshot (10 columnas)
    // Nota: dejamos columna A vacía para que arranque en B (más parecido a tu diseño)
    ws.getColumn(1).width = 2; // A (padding)
    ws.getColumn(2).width = 6; // B: N°
    ws.getColumn(3).width = 22; // C: ingreso
    ws.getColumn(4).width = 22; // D: salida
    ws.getColumn(5).width = 22; // E: motorista
    ws.getColumn(6).width = 16; // F: licencia
    ws.getColumn(7).width = 14; // G: cabezal
    ws.getColumn(8).width = 16; // H: remolque
    ws.getColumn(9).width = 22; // I: transportista
    ws.getColumn(10).width = 26; // J: actividad

    // Alturas de filas del header
    ws.getRow(3).height = 24; // título
    ws.getRow(4).height = 18; // intervalo
    ws.getRow(5).height = 18; // fecha generación
    ws.getRow(6).height = 18; // headers tabla

    // Merges (B3:H3) título, B4:H4 intervalo, etc.
    ws.mergeCells('B3:H3');
    ws.mergeCells('B4:H4');
    ws.mergeCells('B5:H5');

    // Bordes del bloque superior (B3:J5)
    for (let r = 3; r <= 5; r++) {
      for (let c = 2; c <= 10; c++) {
        this.setBorder(ws.getCell(r, c));
      }
    }

    // Título
    const titleCell = ws.getCell('B3');
    titleCell.value = 'REPORTE DE INGRESO DE CAMIONES';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Subtítulo intervalo
    const from = params.meta?.from ?? '';
    const to = params.meta?.to ?? '';
    const intervalCell = ws.getCell('B4');
    intervalCell.value = `Intervalo entre (from) hasta (to)`;
    intervalCell.font = { bold: false, size: 11 };
    intervalCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // “Fecha de generación” (en I5 y J5 como tu diseño)
    ws.getCell('I5').value = 'Fecha de generación';
    ws.getCell('I5').font = { bold: true, size: 10 };
    ws.getCell('I5').alignment = { horizontal: 'center', vertical: 'middle' };
    this.setBorder(ws.getCell('I5'));

    const genCell = ws.getCell('J5');
    genCell.value = new Date(); // date real
    genCell.numFmt = 'dd/mm/yyyy hh:mm';
    genCell.font = { bold: true, size: 10 };
    genCell.alignment = { horizontal: 'center', vertical: 'middle' };
    this.setBorder(genCell);

    // Bloque “rango real” (B5:H5) si querés mostrarlo (opcional)
    const rangeCell = ws.getCell('B5');
    rangeCell.value = `Del ${from} al ${to}`;
    rangeCell.font = { bold: false, size: 10 };
    rangeCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Logo
    this.addLogo(wb, ws);

    // Header de tabla (fila 6)
    const headers = [
      'N°',
      'Fecha y hora de ingreso',
      'Fecha y hora de salida',
      'Motorista',
      'Licencia',
      'Placa cabezal',
      'Placa remolque',
      'Transportista',
      'Actividad',
    ];

    // Escribimos en B..J (2..10)
    for (let i = 0; i < headers.length; i++) {
      const cell = ws.getCell(6, 2 + i);
      cell.value = headers[i];
      cell.font = { bold: true, size: 10 };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'EDEDED' },
      };
      this.setBorder(cell);
    }

    // Filas de datos desde fila 7
    let r = 7;
    for (let i = 0; i < params.rows.length; i++, r++) {
      const row = params.rows[i];
      const ingreso = this.toDate(row.fechayhora_ingreso);
      const salida = this.toDate(row.fechayhora_salida);

      const isAlt = i % 2 === 0; // zebra: primera amarilla suave
      const fill: ExcelJS.Fill = isAlt
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9C4' } } // amarillo suave
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } };

      const values = [
        i + 1,
        ingreso,
        salida,
        row.motorista ?? '',
        row.licencia ?? '',
        row.placa_cabezal ?? '',
        row.placa_remolque ?? '',
        row.transportista ?? '',
        'RECEPCION DE AZUCAR Y MELAZA', // actividad fija como tu ejemplo
      ];

      for (let c = 0; c < values.length; c++) {
        const cell = ws.getCell(r, 2 + c);
        cell.value = values[c] as any;

        // formatos fecha
        if (c === 1 || c === 2) {
          cell.numFmt = 'dd/mm/yyyy hh:mm';
          cell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
            wrapText: true,
          };
        } else if (c === 0) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (c === 4 || c === 5 || c === 6) {
          cell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
            wrapText: true,
          };
        } else {
          cell.alignment = {
            horizontal: 'left',
            vertical: 'middle',
            wrapText: true,
          };
        }

        cell.font = { size: 10 };
        cell.fill = fill;
        this.setBorder(cell);
      }

      ws.getRow(r).height = 18;
    }

    // Autofiltro
    ws.autoFilter = {
      from: 'B6',
      to: 'J6',
    };

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async buildRequiresSweepingWorkbook(params: {
    rows: RequiresSweepingRow[];
    meta?: Record<string, any>;
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'QuickPass';
    wb.created = new Date();

    const ws = wb.addWorksheet('Requiere barrido', {
      views: [{ state: 'frozen', ySplit: 6 }],
    });

    // Config columnas: dejamos A de padding, arrancamos en B
    ws.getColumn(1).width = 2;

    const headers = [
      'N°',
      'Ingenio',
      'Código Generación',
      'ID NAV',
      'Licencia',
      'Motorista',
      'Placa Cabezal',
      'Placa Remolque',
      'Solicitó Barrido',
      'Tipo Barrido',
      'Fecha Prechequeo',
      'Fecha Entrada Planta',
      'Fecha Salida Planta',
    ];

    // Ajuste widths (columnas más anchas para mejor legibilidad)
    const widths = [6, 22, 25, 14, 14, 28, 16, 16, 16, 16, 22, 22, 22];
    for (let i = 0; i < widths.length; i++) {
      ws.getColumn(2 + i).width = widths[i];
    }

    // Header heights
    ws.getRow(3).height = 30;
    ws.getRow(4).height = 24;
    ws.getRow(5).height = 24;
    ws.getRow(6).height = 35;

    const startCol = 2; // B
    const endCol = startCol + headers.length - 1; // columna final
    const titleEndCol = endCol - 2; // dejamos 2 cols a la derecha para “generación”
    const genLabelCol = endCol - 1;
    const genValueCol = endCol;

    // Merges: título/intervalo/rango
    ws.mergeCells(3, startCol, 3, titleEndCol);
    ws.mergeCells(4, startCol, 4, titleEndCol);
    ws.mergeCells(5, startCol, 5, titleEndCol);

    // Bordes bloque superior (fila 3..5, col start..end)
    for (let r = 3; r <= 5; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.setBorder(ws.getCell(r, c));
      }
    }

    // Title
    const titleCell = ws.getCell(3, startCol);
    titleCell.value = 'REQUIERE BARRIDO';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const from = params.meta?.from ?? '';
    const to = params.meta?.to ?? '';
    const ingenioName = params.meta?.ingenioname ?? '';

    const intervalCell = ws.getCell(4, startCol);
    intervalCell.value = `Cliente: ${ingenioName}  |  Del ${from} al ${to}`;
    intervalCell.font = { size: 11 };
    intervalCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const rangeCell = ws.getCell(5, startCol);
    rangeCell.value = `Generado por QuickPass`;
    rangeCell.font = { size: 10 };
    rangeCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // “Fecha de generación” a la derecha (genLabelCol/genValueCol)
    ws.getCell(5, genLabelCol).value = 'Fecha de generación';
    ws.getCell(5, genLabelCol).font = { bold: true, size: 10 };
    ws.getCell(5, genLabelCol).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    this.setBorder(ws.getCell(5, genLabelCol));

    const genCell = ws.getCell(5, genValueCol);
    genCell.value = new Date();
    genCell.numFmt = 'dd/mm/yyyy hh:mm';
    genCell.font = { bold: true, size: 10 };
    genCell.alignment = { horizontal: 'center', vertical: 'middle' };
    this.setBorder(genCell);

    // Logo arriba derecha (reusamos addLogo, pero ubicándolo relativo al final)
    // El addLogo existente lo ubica fijo. Si quieres que quede bien aquí también,
    // lo más simple es dejarlo igual por ahora:
    this.addLogo(wb, ws);

    // Header tabla (fila 6)
    for (let i = 0; i < headers.length; i++) {
      const cell = ws.getCell(6, startCol + i);
      cell.value = headers[i];
      cell.font = { bold: true, size: 10 };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'EDEDED' },
      };
      this.setBorder(cell);
    }

    // Data desde fila 7
    let rr = 7;
    for (let i = 0; i < params.rows.length; i++, rr++) {
      const row = params.rows[i];

      const isAlt = i % 2 === 0;
      const fill: ExcelJS.Fill = isAlt
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9C4' } }
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } };

      const values = [
        i + 1,
        row.ingenio ?? '',
        row.codigo_generacion ?? '',
        row.id_nav ?? '',
        row.licencia ?? '',
        row.motorista ?? '',
        row.placa_cabezal ?? '',
        row.placa_remolque ?? '',
        row.solicito_barrido ?? '',
        row.tipo_barrido ?? '',
        this.toDate(row.fecha_prechequeo),
        this.toDate(row.fecha_entrada_planta),
        this.toDate(row.fecha_salida_planta),
      ];

      for (let c = 0; c < values.length; c++) {
        const cell = ws.getCell(rr, startCol + c);
        cell.value = values[c] as any;

        // formatos fechas (últimas 3 columnas)
        if (c >= 10) {
          cell.numFmt = 'dd/mm/yyyy hh:mm';
          cell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
            wrapText: true,
          };
        } else if (c === 0) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (
          c === 3 ||
          c === 4 ||
          c === 6 ||
          c === 7 ||
          c === 8 ||
          c === 9
        ) {
          cell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
            wrapText: true,
          };
        } else {
          cell.alignment = {
            horizontal: 'left',
            vertical: 'middle',
            wrapText: true,
          };
        }

        cell.font = { size: 10 };
        cell.fill = fill;
        this.setBorder(cell);
      }

      ws.getRow(rr).height = 30;
    }

    ws.autoFilter = {
      from: { row: 6, column: startCol },
      to: { row: 6, column: endCol },
    };

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
