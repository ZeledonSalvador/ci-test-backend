import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfMake = require('pdfmake/build/pdfmake');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfFonts = require('pdfmake/build/vfs_fonts');

// En tu caso, vfs_fonts ES el vfs
pdfMake.vfs = pdfFonts;

// Definir fuentes (Roboto) usando los nombres del vfs
pdfMake.fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
};

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDateTime(value: any) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  // dd/MM/yyyy HH:mm:ss (24h) similar a reportes típicos
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function readLogoBase64(): string | null {
  try {
    const logoPath = path.join(process.cwd(), 'src', 'assets', 'almapac.png');
    if (!fs.existsSync(logoPath)) return null;
    const buf = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

@Injectable()
export class PdfExporter {
  async buildTruckEntryPdf(params: {
    rows: any[];
    meta?: Record<string, any>;
    summary?: { total?: number; minIngreso?: any; maxIngreso?: any };
  }): Promise<Buffer> {
    if (!pdfMake?.vfs) {
      throw new Error('pdfMake.vfs no está disponible.');
    }

    const from = params.meta?.from ?? '';
    const to = params.meta?.to ?? '';
    const total = params.summary?.total ?? 0;

    const generatedAt = new Date();
    const generatedStr = formatDateTime(generatedAt);

    const logo = readLogoBase64();

    // Columnas (adaptadas a tu imagen plantilla)
    // Nota: si querés agregar "Código generación", lo metemos después.
    const header = [
      { text: 'N°', style: 'th', alignment: 'center' },
      { text: 'Fecha y Hora\nDe Ingreso', style: 'th', alignment: 'center' },
      { text: 'Fecha y Hora\nDe Salida', style: 'th', alignment: 'center' },
      { text: 'Motorista', style: 'th', alignment: 'center' },
      { text: 'Licencia', style: 'th', alignment: 'center' },
      { text: 'Placa\nCabezal', style: 'th', alignment: 'center' },
      { text: 'Placa\nRemolque', style: 'th', alignment: 'center' },
      { text: 'Transportista', style: 'th', alignment: 'center' },
      { text: 'Actividad', style: 'th', alignment: 'center' },
    ];

    const body: any[] = [header];

    params.rows.forEach((r, idx) => {
      body.push([
        { text: String(idx + 1), style: 'td', alignment: 'center' },
        {
          text: formatDateTime(r.fechayhora_ingreso),
          style: 'td',
          alignment: 'center',
        },
        {
          text: formatDateTime(r.fechayhora_salida),
          style: 'td',
          alignment: 'center',
        },
        { text: r.motorista ?? '', style: 'td' },
        { text: r.licencia ?? '', style: 'td', alignment: 'center' },
        { text: r.placa_cabezal ?? '', style: 'td', alignment: 'center' },
        { text: r.placa_remolque ?? '', style: 'td', alignment: 'center' },
        { text: r.transportista ?? '', style: 'td' },
        { text: 'Recepción de Azúcar y\nMelaza', style: 'td' },
      ]);
    });

    const docDefinition: any = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [25, 20, 25, 25],

      footer: (currentPage: number, pageCount: number) => {
        return {
          margin: [25, 0, 25, 12],
          columns: [
            {
              text: `Generado: ${generatedStr}`,
              fontSize: 8,
              color: '#444444',
            },
            {
              text: `Página ${currentPage} de ${pageCount}`,
              fontSize: 8,
              alignment: 'right',
              color: '#444444',
            },
          ],
        };
      },

      content: [
        {
          columns: [
            { width: 140, text: '' }, // “reserva” izquierda para balancear el logo
            {
              width: '*',
              stack: [
                {
                  text: 'REPORTE DE INGRESO DE CAMIONES',
                  style: 'title',
                  alignment: 'center',
                },
                {
                  text: `Del ${from} - ${to}`,
                  style: 'subtitle',
                  alignment: 'center',
                },
                {
                  text: `Total: ${total}`,
                  style: 'subtitle2',
                  alignment: 'center',
                  margin: [0, 2, 0, 0],
                },
              ],
              alignment: 'center',
            },
            {
              width: 140,
              alignment: 'right',
              stack: logo
                ? [{ image: logo, width: 120 }]
                : [
                    {
                      text: 'ALMAPAC',
                      style: 'logoFallback',
                      alignment: 'right',
                    },
                  ],
            },
          ],
          margin: [0, 0, 0, 10],
        },

        {
          table: {
            headerRows: 1,
            widths: [22, 70, 70, '*', 60, 55, 60, '*', 90],

            body,
          },
          layout: {
            fillColor: (rowIndex: number) => {
              if (rowIndex === 0) return '#EDEDED'; // header
              return rowIndex % 2 === 0 ? '#F7F7F7' : null; // zebra
            },
            hLineColor: () => '#CFCFCF',
            vLineColor: () => '#CFCFCF',
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
            paddingLeft: () => 5,
            paddingRight: () => 5,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
        },
      ],

      defaultStyle: {
        font: 'Roboto',
        fontSize: 9,
      },

      styles: {
        title: { fontSize: 12, bold: true, color: '#111111' },
        subtitle: { fontSize: 9, color: '#333333' },
        subtitle2: { fontSize: 8, color: '#333333' },
        logoFallback: { fontSize: 12, bold: true, color: '#111111' },

        th: { fontSize: 8, bold: true, color: '#111111' },
        td: { fontSize: 8, color: '#111111' },
      },
    };

    return await new Promise<Buffer>((resolve, reject) => {
      try {
        pdfMake.createPdf(docDefinition).getBuffer((buffer: Uint8Array) => {
          resolve(Buffer.from(buffer));
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async buildRequiresSweepingPdf(params: {
    rows: any[];
    meta?: Record<string, any>;
    summary?: { total?: number; minEntrada?: any; maxSalida?: any };
  }): Promise<Buffer> {
    if (!pdfMake?.vfs) throw new Error('pdfMake.vfs no está disponible.');

    const from = params.meta?.from ?? '';
    const to = params.meta?.to ?? '';
    const ingenioCode = params.meta?.ingenioCode ?? '';
    const ingenioname = params.meta?.ingenioname ?? '';
    const total = params.summary?.total ?? params.rows?.length ?? 0;

    const generatedAt = new Date();
    const generatedStr = formatDateTime(generatedAt);
    const logo = readLogoBase64();

    const header = [
      { text: 'N°', style: 'th', alignment: 'center' },
      { text: 'Ingenio', style: 'th', alignment: 'center' },
      { text: 'Código\nGeneración', style: 'th', alignment: 'center' },
      { text: 'ID NAV', style: 'th', alignment: 'center' },
      { text: 'Licencia', style: 'th', alignment: 'center' },
      { text: 'Motorista', style: 'th', alignment: 'center' },
      { text: 'Cabezal', style: 'th', alignment: 'center' },
      { text: 'Remolque', style: 'th', alignment: 'center' },
      { text: 'Solicitó\nBarrido', style: 'th', alignment: 'center' },
      { text: 'Tipo\nBarrido', style: 'th', alignment: 'center' },
      { text: 'Prechequeo', style: 'th', alignment: 'center' },
      { text: 'Entrada\nPlanta', style: 'th', alignment: 'center' },
      { text: 'Salida\nPlanta', style: 'th', alignment: 'center' },
    ];

    const body: any[] = [header];

    params.rows.forEach((r, idx) => {
      body.push([
        { text: String(idx + 1), style: 'td', alignment: 'center' },
        { text: r.ingenio ?? '', style: 'td' },
        { text: r.codigo_generacion ?? '', style: 'td' },
        { text: String(r.id_nav ?? ''), style: 'td', alignment: 'center' },
        { text: r.licencia ?? '', style: 'td', alignment: 'center' },
        { text: r.motorista ?? '', style: 'td' },
        { text: r.placa_cabezal ?? '', style: 'td', alignment: 'center' },
        { text: r.placa_remolque ?? '', style: 'td', alignment: 'center' },
        { text: r.solicito_barrido ?? '', style: 'td', alignment: 'center' },
        { text: r.tipo_barrido ?? '', style: 'td', alignment: 'center' },
        {
          text: formatDateTime(r.fecha_prechequeo),
          style: 'td',
          alignment: 'center',
        },
        {
          text: formatDateTime(r.fecha_entrada_planta),
          style: 'td',
          alignment: 'center',
        },
        {
          text: formatDateTime(r.fecha_salida_planta),
          style: 'td',
          alignment: 'center',
        },
      ]);
    });

    const docDefinition: any = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [25, 20, 25, 25],

      footer: (currentPage: number, pageCount: number) => ({
        margin: [25, 0, 25, 12],
        columns: [
          { text: `Generado: ${generatedStr}`, fontSize: 8, color: '#444444' },
          {
            text: `Página ${currentPage} de ${pageCount}`,
            fontSize: 8,
            alignment: 'right',
            color: '#444444',
          },
        ],
      }),

      content: [
        {
          columns: [
            { width: 140, text: '' },
            {
              width: '*',
              stack: [
                {
                  text: 'REQUIERE BARRIDO',
                  style: 'title',
                  alignment: 'center',
                },
                {
                  text: `CLIENTE: ${ingenioname}`,
                  style: 'subtitle',
                  alignment: 'center',
                },
                {
                  text: `Del ${from} - ${to}`,
                  style: 'subtitle',
                  alignment: 'center',
                },
                {
                  text: `Total: ${total}`,
                  style: 'subtitle2',
                  alignment: 'center',
                  margin: [0, 2, 0, 0],
                },
              ],
            },
            {
              width: 140,
              alignment: 'right',
              stack: logo
                ? [{ image: logo, width: 120 }]
                : [
                    {
                      text: 'ALMAPAC',
                      style: 'logoFallback',
                      alignment: 'right',
                    },
                  ],
            },
          ],
          margin: [0, 0, 0, 10],
        },

        {
          table: {
            headerRows: 1,
            // widths ajustadas para landscape A4 (~800px)
            widths: [18, 80, '*', 35, 60, 60, 42, 45, 30, 40, 55, 55, 55],
            body,
          },
          layout: {
            fillColor: (rowIndex: number) => {
              if (rowIndex === 0) return '#EDEDED';
              return rowIndex % 2 === 0 ? '#F7F7F7' : null;
            },
            hLineColor: () => '#CFCFCF',
            vLineColor: () => '#CFCFCF',
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
            paddingLeft: () => 3,
            paddingRight: () => 3,
            paddingTop: () => 3,
            paddingBottom: () => 3,
          },
        },
      ],

      defaultStyle: { font: 'Roboto', fontSize: 7 },
      styles: {
        title: { fontSize: 12, bold: true, color: '#111111' },
        subtitle: { fontSize: 9, color: '#333333' },
        subtitle2: { fontSize: 8, color: '#333333' },
        logoFallback: { fontSize: 12, bold: true, color: '#111111' },
        th: { fontSize: 7, bold: true, color: '#111111' },
        td: { fontSize: 7, color: '#111111' },
      },
    };

    return await new Promise<Buffer>((resolve, reject) => {
      try {
        pdfMake
          .createPdf(docDefinition)
          .getBuffer((buffer: Uint8Array) => resolve(Buffer.from(buffer)));
      } catch (err) {
        reject(err);
      }
    });
  }
}
