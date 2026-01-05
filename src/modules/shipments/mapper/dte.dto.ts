export class IdentificacionDTO {
    version: number;
    ambiente: string;
    tipoDte: string;
    numeroControl: string;
    codigoGeneracion: string;
    tipoModelo: number;
    tipoOperacion: number;
    tipoContingencia: string | null;
    motivoContin: string | null;
    fecEmi: string;
    horEmi: string;
    tipoMoneda: string;
}

export class DireccionDTO {
    departamento: string;
    municipio: string;
    complemento: string;
}

export class EmisorDTO {
    nit: string;
    nrc: string;
    nombre: string;
    codActividad: string;
    descActividad: string;
    nombreComercial: string | null;
    tipoEstablecimiento: string;
    direccion: DireccionDTO;
    telefono: string;
    correo: string;
    codEstableMH: string;
    codEstable: string | null;
    codPuntoVentaMH: string;
    codPuntoVenta: string | null;
}

export class ReceptorDTO {
    tipoDocumento: string;
    numDocumento: string;
    nrc: string;
    nombre: string;
    codActividad: string;
    descActividad: string;
    nombreComercial: string | null;
    direccion: DireccionDTO;
    telefono: string;
    correo: string;
    bienTitulo: string;
}

export class CuerpoDocumentoDTO {
    numItem: number;
    tipoItem: number;
    numeroDocumento: string | null;
    codigo: string;
    codTributo: string | null;
    descripcion: string;
    cantidad: number;
    uniMedida: number;
    precioUni: number;
    montoDescu: number;
    ventaNoSuj: number;
    ventaExenta: number;
    ventaGravada: number;
    tributos: any | null;
}

export class ResumenDTO {
    totalNoSuj: number;
    totalExenta: number;
    totalGravada: number;
    subTotalVentas: number;
    descuNoSuj: number;
    descuExenta: number;
    descuGravada: number;
    porcentajeDescuento: number;
    totalDescu: number;
    tributos: any | null;
    subTotal: number;
    montoTotalOperacion: number;
    totalLetras: string;
}

export class ExtensionDTO {
    nombEntrega: string | null;
    docuEntrega: string | null;
    nombRecibe: string | null;
    docuRecibe: string | null;
    observaciones: string;
}

export class ApendiceDTO {
    campo: string;
    etiqueta: string;
    valor: string;
}

export class ResponseMHDTO {
    version: number;
    ambiente: string;
    versionApp: number;
    estado: string;
    codigoGeneracion: string;
    numeroControl: string;
    selloRecibido: string;
    fhProcesamiento: string;
    codigoMsg: string;
    descripcionMsg: string;
    observaciones: any[];
}

export class DocumentoDTO {
    identificacion: IdentificacionDTO;
    documentoRelacionado: any | null;
    emisor: EmisorDTO;
    receptor: ReceptorDTO;
    ventaTercero: any | null;
    cuerpoDocumento: CuerpoDocumentoDTO[];
    resumen: ResumenDTO;
    extension: ExtensionDTO;
    apendice: ApendiceDTO[];
    responseMH: ResponseMHDTO;
    codigoEmpresa: string;
    token: string;
}
