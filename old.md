Este endpoint permite la creación de un envío mediante la subida de un DTE (Documento Tributario Electrónico) en formato JSON. Los datos necesarios para el envío se extraen y mapean desde distintas secciones del DTE, incluyendo el apéndice (que permite insertar datos adicionales). Algunos datos importantes como el código de generación y el tipo de producto provienen de otras secciones del DTE.
Ejemplo de Mapeo de Datos
A continuación, se muestra un ejemplo de cómo se mapean algunos datos clave del DTE al objeto de envío (shipmentDocument):

TypeScript

// Asignación de datos en el objeto de envío
this.shipmentDocument.codigo_gen = this.obJectDte.identificacion.codigoGeneracion;
this.shipmentDocument.producto = this.buildTypeFromEnum(this.obJectDte.cuerpoDocumento[0].descripcion, ProductType);
this.shipmentDocument.tipo_operacion = this.buildTypeFromEnum(this.apendiceBuiled.main?.tipo_operacion || null, TipoOperacion);
this.shipmentDocument.tipo_carga = this.buildTypeFromEnum(this.apendiceBuiled.main?.tipo_carga || null, TipoCarga);
// Datos de Motorista y Vehículo
this.shipmentDocument.vehiculo.motorista.licencia = this.apendiceBuiled.main?.licencia || null;
this.shipmentDocument.vehiculo.motorista.nombre = this.apendiceBuiled.motorista?.motorista || null;
this.shipmentDocument.vehiculo.placa = this.apendiceBuiled.motorista?.placa || null;
this.shipmentDocument.vehiculo.placa_remolque = this.apendiceBuiled.motorista?.remolque || null;
this.shipmentDocument.vehiculo.tipo_camion = this.buildTypeFromEnum(this.apendiceBuiled.main?.tipo_camion || null, TipoCamion);
// Otros datos del envío
this.shipmentDocument.transportista.nombre = this.apendiceBuiled.motorista?.empresa || null;
this.shipmentDocument.codigo_ingenio = this.obJectDte.codigoEmpresa;
this.shipmentDocument.cantidad_producto = this.obJectDte.cuerpoDocumento[0].cantidad;
this.shipmentDocument.unidad_medida = this.apendiceBuiled.main?.unidad_medida || "kg";
this.shipmentDocument.require_barrido = this.buildTypeFromEnum(this.apendiceBuiled.others?.require_barrido || null, RequiresSweepingType);
this.shipmentDocument.marchamos = this.apendiceBuiled.others?.marchamos || null;

Formato del Apéndice
El apéndice puede configurarse en dos formatos:
Formato Tradicional: Los datos se organizan en pares clave-valor, donde cada campo, etiqueta y valor se define explícitamente en el JSON. Este es el formato actualmente en uso, pero se recomienda usar el formato optimizado.

JSON

{
"campo": "peso",
"etiqueta": "Peso1|Fecha1|Peso2|Fecha3|Peso3|Fecha3",
"valor": "15,260.000|26/12/2023 09:41:50|41,230.000|26/12/2023 11:15:20|25,970.000|26/12/2023 11:15:20"
}

Formato Optimizado: En este formato, valor contiene una cadena en formato CSV y etiqueta define las columnas. Este formato tiene dos nodos principales:
main: Contiene claves fijas y obligatorias.
others: Contiene campos adicionales opcionales.

JSON

{
"campo": "main:_ALMAPAC_API_INTERNAL_HEADER_WATERMARK_SERIALIZER_",
"etiqueta": "licencia|placa*remolque|tipo_operacion|tipo_carga|tipo_camion",
"valor": "licencia:\"221311232P\", placa_remolque:\"JJEKWK\", tipo_operacion:\"C\", tipo_carga:\"G\", tipo_camion:\"V\""
},
{
"campo": "others:\_ALMAPAC_API_INTERNAL_HEADER_WATERMARK_SERIALIZER*",
"etiqueta": "require_barrido|marchamos",
"valor": "require_barrido:\"N\", marchamos:\"34234,23213\""
}

Clase CSVEncoderApendice
La clase CSVEncoderApendice permite la codificación y decodificación de pares clave-valor en un formato basado en CSV. Añade una marca de agua para la verificación de integridad y puede replicarse en otros lenguajes para facilitar la interoperabilidad.
Ejemplo de Uso

TypeScript

const otros = new CSVEncoderApendice("otros", {
licencia: "221311232P",
placa*remolque: "JJEKWK"
});
console.log("Codificación: ", otros.toJSON());
console.log("Decodificación: ", CSVEncoderApendice.fromJSON({
campo: "otros:\_ALMAPAC_API_INTERNAL_HEADER_WATERMARK_SERIALIZER*",
etiqueta: "licencia|placa_remolque",
valor: 'licencia:"221311232P", placa_remolque:"JJEKWK"'
}).decode());

Definición de la Clase

TypeScript

/\*\*

- Clase CSVEncoderApendice.
- Utilizada para codificar y decodificar pares de clave-valor en un formato CSV.
- Añade una marca de agua para verificar la integridad de los datos.
  \*/
  export default class CSVEncoderApendice {
  campo: string;
  etiqueta: string;
  valor: string;
  private static readonly WATERMARK = "_ALMAPAC_API_INTERNAL_HEADER_WATERMARK_SERIALIZER_";
  constructor(campo: string, valores: { [key: string]: string | string[] }) {
  this.campo = `${campo}:${CSVEncoderApendice.WATERMARK}`;
  this.etiqueta = Object.keys(valores).join("|");
  this.valor = this.encode(valores);
  }
  private encode(data: { [key: string]: string | string[] }): string {
  return Object.entries(data).map(([key, value]) => {
  return Array.isArray(value) ? `${key}:"${value.join(",")}"` : `${key}:"${value}"`;
  }).join(", ");
  }
  decode(): { [key: string]: string | string[] } {
  if (!CSVEncoderApendice.isDecodable(this.toJSON())) {
  throw new Error("Este objeto no contiene la marca de agua y no puede ser decodificado.");
  }
  return this.valor.split(", ").reduce((acc, pair) => {
  const [key, value] = pair.split(":").map(v => v.replace(/"/g, ''));
  acc[key] = value.includes(",") ? value.split(",") : value;
  return acc;
  }, {} as { [key: string]: string | string[] });
  }
  static isDecodable(object: { campo: string; etiqueta: string; valor: string }): boolean {
  return object.campo.endsWith(CSVEncoderApendice.WATERMARK);
  }
  static fromJSON(json: { campo: string; etiqueta: string; valor: string }): CSVEncoderApendice {
  const instance = new CSVEncoderApendice(json.campo.replace(`:${CSVEncoderApendice.WATERMARK}`, ''), {});
  instance.valor = json.valor;
  return instance;
  }
  toJSON(): { campo: string; etiqueta: string; valor: string } {
  return { campo: this.campo, etiqueta: this.etiqueta, valor: this.valor };
  }
  }
