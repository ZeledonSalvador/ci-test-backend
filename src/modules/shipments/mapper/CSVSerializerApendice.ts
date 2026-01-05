import { ApendiceDTO } from "./dte.dto";
import { TransformedData } from "./types";

/**
 * Clase CSVEncoderApendice.
 * Esta clase se utiliza para codificar y decodificar pares de clave-valor 
 * en un formato basado en CSV (Comma-Separated Values), añadiendo una marca de 
 * agua para verificar la integridad de los datos. 
 * 
 * Fue creada para codificar y decodificar objetos del apéndice del JSON del 
 * DTE (Documento Tributario Electrónico) de la nota de remisión, permitiendo 
 * transportar datos de una manera ordenada.
 *
 * Ejemplo de uso:
 * 
 * const otros = new CSVEncoderApendice("otros", {
 *     licencia: "221311232P",
 *     placa_remolque: "JJEKWK"
 * });
 * 
 * console.log("Encode: ", otros.toJSON());
 * 
 * console.log("Decode: ", CSVEncoderApendice.fromJSON({
 *     campo: "otros:_ALMAPAC_API_INTERNAL_HEADER_WATERMARK_SERIALIZER_",
 *     etiqueta: "licencia|placa_remolque",
 *     valor: 'licencia:"221311232P", placa_remolque:"JJEKWK"'
 * }).decode());
 */
export default class CSVEncoderApendice {
    campo: string; // Campo que identifica el objeto, con la marca de agua añadida.
    etiqueta: string; // Etiqueta que representa las claves de los valores codificados.
    valor: string; // Valores codificados en formato de cadena.

    // Marca de agua estática utilizada para validar la codificación.
    private static readonly WATERMARK = "_ALMAPAC_API_INTERNAL_HEADER_WATERMARK_SERIALIZER_";

    /**
     * Constructor de la clase.
     * @param campo - Nombre del campo que se va a codificar.
     * @param valores - Objeto que contiene los pares clave-valor a codificar.
     */
    constructor(campo: string, valores: { [key: string]: string | string[] }) {
        this.campo = `${campo}:${CSVEncoderApendice.WATERMARK}`; // Asigna el campo con la marca de agua.
        this.etiqueta = Object.keys(valores).join("|"); // Crea la etiqueta a partir de las claves.
        this.valor = this.encode(valores); // Codifica los valores proporcionados.
    }

    /**
     * Método privado para codificar los valores en formato CSV.
     * @param data - Objeto con pares clave-valor a codificar.
     * @returns Cadena codificada en formato CSV.
     */
    private encode(data: { [key: string]: string | string[] }): string {
        return Object.entries(data)
            .map(([key, value]) => {
                if (Array.isArray(value)) {
                    return `${key}:"${value.join(",")}"`; // Combina valores en un string separado por comas.
                }
                return `${key}:"${value}"`; // Devuelve el valor como una cadena.
            })
            .join(", "); // Une todos los pares en una sola cadena.
    }

    /**
     * Método para decodificar el valor codificado y devolver un objeto original.
     * @returns Objeto que contiene los pares clave-valor decodificados.
     * @throws Error si la marca de agua no está presente.
     */
    decode(): { [key: string]: string | string[] } {
        if (!CSVEncoderApendice.isDecodable(this.toJSON())) {
            throw new Error("Este objeto no contiene la marca de agua y no puede ser decodificado.");
        }

        this.campo = this.campo.replace(`:${CSVEncoderApendice.WATERMARK}`, '');

        return this.valor.split(", ").reduce((acc, pair) => {
            const [key, value] = pair.split(":");
            const cleanedKey = key.trim();
            const cleanedValue = value.trim().replace(/"/g, '')
            acc[cleanedKey] = cleanedValue.includes(",") ? cleanedValue.split(",") : cleanedValue;
            return acc;
        }, {} as { [key: string]: string | string[] });
    }

    /**
     * Método para convertir la instancia actual en un objeto JSON.
     * @returns Objeto JSON que representa la instancia.
     */
    toJSON(): { campo: string; etiqueta: string; valor: string } {
        return {
            campo: this.campo, // Campo con la marca de agua.
            etiqueta: this.etiqueta, // Etiqueta de claves.
            valor: this.valor // Valores codificados.
        };
    }


    /**
 * Método estático para verificar si un objeto es decodificable.
 * @param object - Objeto que se va a verificar.
 * @returns true si el objeto contiene la marca de agua; false en caso contrario.
 */
    static isDecodable(object: { campo: string; etiqueta: string; valor: string }): boolean {
        return object.campo.endsWith(CSVEncoderApendice.WATERMARK);
    }

    /**
  * Método estático para crear una instancia de CSVEncoderApendice a partir de un objeto JSON.
  * @param json - Objeto JSON que representa un CSVEncoderApendice.
  * @returns Instancia de CSVEncoderApendice.
  */
    static fromJSON(json: { campo: string; etiqueta: string; valor: string }): CSVEncoderApendice {
        const csvSerializer = new CSVEncoderApendice(
            json.campo.replace(`:${CSVEncoderApendice.WATERMARK}`, ''),
            {}
        );
        csvSerializer.valor = json.valor; // Asigna el valor del JSON al objeto.
        return csvSerializer; // Devuelve la instancia creada.
    }


    static sanitizateCampo(campo: string = null) {
        return campo.replace(`:${CSVEncoderApendice.WATERMARK}`, '');
    }


    /* 
        Este es el enconder que ya existe y esta perfecto
        funciona bien
    */
    static transformDataApendicekeysOldVersion(input: ApendiceDTO): TransformedData<ApendiceDTO['campo']> {
        const { campo, etiqueta, valor } = input;
        const resultado = { [campo]: {} };
        if (etiqueta.includes('|') && valor.includes('|')) {
            const etiquetasArray = etiqueta.split('|').map(e => e.trim());
            const valoresArray = valor.split('|').map(v => v.trim());

            etiquetasArray.forEach((etiqueta, index) => {
                const rawValor = valoresArray[index];
                if (rawValor !== undefined && rawValor !== '') {
                    resultado[campo][etiqueta] = rawValor.includes(',')
                        ? rawValor.split(',').map(v => v.trim())
                        : rawValor;
                } else {
                    resultado[campo][etiqueta] = null;
                }
            });
        } else {
            resultado[campo][etiqueta] = valor.includes(' ')
                ? valor.split(' ').map(v => v.trim())
                : valor;
        }

        return resultado;
    }




    static buildApendice(apendices: ApendiceDTO[]): { [key: string]: string | string[] } {
        const result: { [key: string]: any } = {};

        apendices.forEach((apendice) => {
            if (CSVEncoderApendice.isDecodable(apendice)) {
                result[CSVEncoderApendice.sanitizateCampo(apendice.campo)] =
                    CSVEncoderApendice.fromJSON(apendice).decode();
            } else if (
                typeof apendice.campo === 'string' &&
                typeof apendice.etiqueta === 'string' &&
                typeof apendice.valor === 'string'
            ) {
                const transformedData = this.transformDataApendicekeysOldVersion(apendice);
                result[apendice.campo] = typeof transformedData === 'object' &&
                    transformedData[apendice.campo] ?
                    transformedData[apendice.campo] :
                    transformedData;
            } else {
                result[apendice.campo] = apendice;
            }
        });

        return result;
    }

}