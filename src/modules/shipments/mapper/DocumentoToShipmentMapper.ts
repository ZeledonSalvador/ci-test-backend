import { BadRequestException } from '@nestjs/common';
import { CreateShipmentDto } from '../dto/shipmentRequest.dto';
import { ProductType } from '../enums/productType.enum';
import { RequiresSweepingType } from '../enums/requiresSweepingType.enum';
import { TipoCamion } from '../enums/tipoCamion.enum';
import { TipoCarga } from '../enums/tipoCarga.enum';
import { TipoOperacion } from '../enums/tipoOperacion.enum';
import { MassUnit } from '../enums/unitMeasure.enum';
import CSVEncoderApendice from './CSVSerializerApendice';
import { DocumentoDTO } from './dte.dto';
import { FindTypesDte, PropertyConfig } from './types';
import UnitService from 'src/utils/UnitServiceHacienda';
import { Role } from 'src/modules/auth/enums/roles.enum';

export default class DocumentToShipmentMapper {
  private jsonDte: string = null;
  private obJectDte: DocumentoDTO;
  private shipmentDocument: CreateShipmentDto = new CreateShipmentDto();
  private apendiceBuiled = null;
  private getTruckTypeVehicleByPlateAndTrailerPlate: (
    plate: string,
    trailerPlate: string,
  ) => Promise<any>;
  private errorLogsInSearchAndParsers: string[] = [];
  private ingenioLogsService?: any;
  private userFromSession?: any;

  public constructor(
    json: string,
    getTruckTypeVehicleByPlateAndTrailerPlate: (
      plate: string,
      trailerPlate: string,
    ) => Promise<any>,
    ingenioLogsService?: any,
    userFromSession?: any,
  ) {
    this.jsonDte = json;
    try {
      this.obJectDte = JSON.parse(this.jsonDte);
    } catch (error) {
      console.error('❌ Error al parsear JSON del DTE:', error.message);
      throw new BadRequestException(
        `El JSON del DTE está malformado o es inválido: ${error.message}`,
      );
    }

    try {
      this.apendiceBuiled = CSVEncoderApendice.buildApendice(
        this.obJectDte.apendice,
      );
    } catch (error) {
      console.error('⚠️ Error al construir apéndice:', error.message);
      this.apendiceBuiled = null;
    }

    this.getTruckTypeVehicleByPlateAndTrailerPlate =
      getTruckTypeVehicleByPlateAndTrailerPlate;
    this.ingenioLogsService = ingenioLogsService;
    this.userFromSession = userFromSession;
    this.errorLogsInSearchAndParsers = [];
  }

  /**
   * Helper para determinar si se debe registrar logs de ingenio
   */
  private shouldLogIngenio(): boolean {
    if (!this.userFromSession) return false;
    const roles = this.userFromSession.roles || [];
    return roles.includes(Role.CLIENT);
  }

  /**
   * Helper para generar username para logs
   */
  private generateUsernameForLog(): string {
    if (!this.userFromSession) return 'UNKNOWN';

    const roles = this.userFromSession.roles || [];
    if (roles.includes(Role.CLIENT)) {
      return `${this.userFromSession.username}`;
    }

    return this.userFromSession.username || 'UNKNOWN';
  }

  private async getPropertyConfig(): Promise<Record<string, PropertyConfig>> {
    return {
      tipo_operacion: {
        // FUNCIONA!
        setAndTryParserObject: TipoOperacion,
        defaultValue: TipoOperacion.DESCARGA,
        defaultPriority: false,
        searchBy: [
          FindTypesDte.APPENDICE,
          FindTypesDte.DEFAULT_VALUE_IN_CONFIG,
        ],
      },
      producto: {
        searchBy: FindTypesDte.DIRECT_KEY,
        setDirectKeyFromDTE: 'cuerpoDocumento[0].descripcion',
        customFunctionWhenFindInDTE: (value) => {
          const desc = value?.toString().toUpperCase().trim();
          if (desc.includes('MELAZA')) return 'MEL-001';
          if (desc.includes('AZUCAR')) return 'AZ-001';
          return ProductType.AZUCAR_CRUDO_GRANEL; // fallback
        },
      },

      tipo_carga: {
        // FUNCIONA
        setAndTryParserObject: TipoCarga,
        defaultValue: TipoCarga.GRANEL,
        defaultPriority: false,
        searchBy: [
          FindTypesDte.APPENDICE,
          FindTypesDte.DEFAULT_VALUE_IN_CONFIG,
        ],
      },
      transportista: {
        // FUNCIONA
        permutations: [
          'Transp',
          'traportistaingenio',
          'empresa',
          'transportista',
        ],
        searchBy: FindTypesDte.APPENDICE,
        customFunctionWhenFindInDTE: (value) => {
          return Array.isArray(value) ? value.join(', ') : value;
        },
      },
      placa: {
        // FUNCIONA
        permutations: ['placa_vehiculo', 'placa_camion', 'placa'],
        searchBy: FindTypesDte.APPENDICE,
      },
      placa_remolque: {
        // FUNCIONA
        permutations: ['placa_remolque', 'remolque'],
        searchBy: FindTypesDte.APPENDICE,
      },
      motorista: {
        // FUNCIONA
        permutations: ['motorista'],
        searchBy: FindTypesDte.APPENDICE,
      },

      codigo_ingenio: {
        // FUNCIONA
        setDirectKeyFromDTE: 'codigoEmpresa',
        searchBy: FindTypesDte.DIRECT_KEY,
      },
      code_gen: {
        // FUNCIONA
        setDirectKeyFromDTE: 'identificacion.codigoGeneracion',
        searchBy: FindTypesDte.DIRECT_KEY,
      },
      require_barrido: {
        // FUNCIONA
        setAndTryParserObject: RequiresSweepingType,
        defaultValue: RequiresSweepingType.NO,
        defaultPriority: false,
        searchBy: [
          FindTypesDte.APPENDICE,
          FindTypesDte.DEFAULT_VALUE_IN_CONFIG,
        ],
      },
      marchamos: {
        // FUNCIONA
        customFunctionWhenFindInDTE: (value) => {
          if (Array.isArray(value)) {
            return value;
          }
          const matches = value.match(/\b\d+\b/g);
          return matches ? matches : [];
        },
        permutations: ['marchamo', 'marchamos'],
        searchBy: [FindTypesDte.APPENDICE, FindTypesDte.All_VALUES_OBJECT],
      },
      licencia: {
        // FUNCIONA, TODO: Definir que hacer cuando no venga
        searchBy: FindTypesDte.APPENDICE,
        throwError: 'La licencia es obligatoria!',
      },
      tipo_camion: {
        //FUNCIONA
        customFunctionGetExternalDataObject: {
          function: this.getTruckTypeVehicleByPlateAndTrailerPlate,
          parameters: {
            plate: () => this.findValue('placa'),
            placa_remolque: () => this.findValue('placa_remolque'),
          },
        },
        setAndTryParserObject: TipoCamion,
        searchBy: FindTypesDte.APPENDICE,
        throwError:
          'No se pudo encontrar el tipo de camion con las placas proporcionadas',
      },
      unidad_medida: {
        // FUNCIONA
        setAndTryParserObject: MassUnit,
        setDirectKeyFromDTE: 'cuerpoDocumento[0].uniMedida',
        searchBy: FindTypesDte.DIRECT_KEY,
        customFunctionWhenFindInDTE: async (unitMessure) => {
          if (unitMessure == 59) {
            const result = await this.findPropAgain('unidad_medida', {
              setAndTryParserObject: MassUnit,
              permutations: ['Peso Neto'],
              searchBy: [
                FindTypesDte.APPENDICE,
                FindTypesDte.All_VALUES_OBJECT,
              ],
              customFunctionWhenFindInDTE: (unitMessure) => {
                const regex = /(\d+[\.,]?\d*)\s*([a-zA-Z]+)/;
                const match = unitMessure.match(regex);
                return match ? match[2].toLowerCase() : null;
              },
            });
            return result;
          }

          return UnitService.getUnit(unitMessure).abbreviation;
        },
      },
      cantidad_producto: {
        setDirectKeyFromDTE: 'cuerpoDocumento[0].cantidad',
        searchBy: FindTypesDte.DIRECT_KEY,
        customFunctionWhenFindInDTE: async (productQuantity) => {
          let productQuantityReturn = productQuantity;
          const findUnitMessugerInDirectykey = await this.findPropAgain(
            'unidad_medida',
            {
              searchBy: FindTypesDte.DIRECT_KEY,
              setDirectKeyFromDTE: 'cuerpoDocumento[0].uniMedida',
            },
          );

          if (findUnitMessugerInDirectykey == 59) {
            /* 
                            Si es unidad lo mas problable es que no sea
                            de fiar la key cuerpoDocumento[0].cantidad
                        */

            productQuantityReturn = await this.findPropAgain(
              'cantidad_producto',
              {
                searchBy: [
                  FindTypesDte.APPENDICE,
                  FindTypesDte.All_VALUES_OBJECT,
                ],
                permutations: ['peso3', 'Peso Neto'],
                customFunctionWhenFindInDTE: async (productQuantity) => {
                  productQuantity = Array.isArray(productQuantity)
                    ? productQuantity.join('')
                    : productQuantity;
                  if (!productQuantity) return null;

                  // Buscar número después de ":" y antes de una unidad de medida
                  const regex = /:\s*([\d.,]+)\s*\w+/;
                  const match = productQuantity.match(regex);
                  if (match) {
                    const number = parseFloat(match[1].replace(/,/g, ''));
                    return isNaN(number) ? null : number;
                  }
                  // Intentar convertirlo a número directamente si no coincide con el formato anterior
                  const number = parseFloat(
                    productQuantity.toString().replace(/,/g, ''),
                  );
                  return isNaN(number) ? null : number;
                },
              },
            );
          }

          return productQuantityReturn;
        },
      },
      peso_bruto: {
        // Buscar en apéndice y en cualquier valor del DTE por etiquetas comunes
        permutations: ['Peso1', 'peso1', 'peso bruto', 'bruto'],
        searchBy: [FindTypesDte.APPENDICE, FindTypesDte.All_VALUES_OBJECT],
        customFunctionWhenFindInDTE: (value) => this.parseNumeric(value), // → number | null
      },

      peso_tara: {
        permutations: ['Peso2', 'peso2', 'peso tara', 'tara'],
        searchBy: [FindTypesDte.APPENDICE, FindTypesDte.All_VALUES_OBJECT],
        customFunctionWhenFindInDTE: (value) => this.parseNumeric(value),
      },
    };
  }

  private parseNumeric(value: any): number | null {
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;

    let text = Array.isArray(value) ? value.join(' ') : String(value);
    // toma el primer número (soporta miles con . o , y decimales con . o ,)
    const m = text.match(/-?\d+(?:[.,]\d{3})*(?:[.,]\d+)?/);
    if (!m) return null;

    let numStr = m[0];

    // Normaliza: si hay ambos separadores, asume que el último símbolo es decimal
    const lastComma = numStr.lastIndexOf(',');
    const lastDot = numStr.lastIndexOf('.');
    const lastSep = Math.max(lastComma, lastDot);

    if (lastSep !== -1) {
      const decimalSep = numStr[lastSep];
      // elimina todos los separadores
      numStr = numStr.replace(/[.,]/g, '');
      // reinsertar separador decimal como punto
      if (decimalSep) {
        numStr = numStr.slice(0, lastSep) + '.' + numStr.slice(lastSep);
      }
    }

    const n = Number(numStr);
    return Number.isFinite(n) ? n : null;
  }

  async findPropAgain(prop: string, objectConfig: PropertyConfig) {
    const originalGetPropertyConfig = this.getPropertyConfig;
    this.getPropertyConfig = async () => {
      const propertyConfig = await originalGetPropertyConfig.call(this);
      propertyConfig[prop] = { ...objectConfig };
      return propertyConfig;
    };

    try {
      const result = await this.findValue(prop);
      this.getPropertyConfig = originalGetPropertyConfig;
      return result;
    } finally {
      this.getPropertyConfig = originalGetPropertyConfig;
    }
  }

  buildTypeFromEnum<T extends Record<string, string>>(
    descripcion: string,
    enumType: T,
  ): T[keyof T] | null {
    if (!descripcion) {
      return null;
    }
    const normalizedDescripcion = descripcion
      ? descripcion.trim().toLowerCase()
      : null;

    // 1. Buscar en los valores del enum
    const valueKey = Object.keys(enumType).find(
      (key) => enumType[key as keyof T].toLowerCase() === normalizedDescripcion,
    );

    if (valueKey) {
      return enumType[valueKey as keyof T];
    }

    // 2. Buscar en las claves del enum
    const keyMatch = Object.keys(enumType).find(
      (key) => key.toLowerCase() === normalizedDescripcion,
    );

    if (keyMatch) {
      return enumType[keyMatch as keyof T];
    }

    // 3. Buscar en la primera letra de los valores
    const firstLetterValueMatch = Object.keys(enumType).find(
      (key) =>
        enumType[key as keyof T].charAt(0).toLowerCase() ===
        normalizedDescripcion.charAt(0),
    );

    if (firstLetterValueMatch) {
      return enumType[firstLetterValueMatch as keyof T];
    }

    // 4. Buscar en la primera letra de las claves
    const firstLetterKeyMatch = Object.keys(enumType).find(
      (key) => key.charAt(0).toLowerCase() === normalizedDescripcion.charAt(0),
    );

    if (firstLetterKeyMatch) {
      return enumType[firstLetterKeyMatch as keyof T];
    }

    // 5. Comprobar si existe la clave "OTRO" en el enum (ajusta el nombre si es necesario)
    const otrosKey = 'OTRO';
    if (enumType.hasOwnProperty(otrosKey)) {
      return enumType[otrosKey as keyof T];
    }
    return null;
  }

  /* 
        Esta funcion solamente es de debug
        para saber que campos no se estan rellenando
    */
  private fillEmptyFields(obj: any): {
    allFieldsComplete: boolean;
    completedObject: any;
    incompleteFields: any;
    errorLogsInSearchAndParsers: string[];
    decodeApendice: any;
  } {
    const result = {
      allFieldsComplete: true,
      errorLogsInSearchAndParsers: this.errorLogsInSearchAndParsers,
      completedObject: {},
      incompleteFields: {},
      decodeApendice: this.apendiceBuiled,
    };

    // Función auxiliar para crear objetos anidados a partir de claves con notación de puntos
    const setNestedProperty = (obj: any, path: string, value: any) => {
      const keys = path.split('.');
      let current = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = isNaN(Number(keys[i + 1])) ? {} : [];
        }
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
    };

    const processObject = (inputObj: any, parentKey: string = '') => {
      for (const key in inputObj) {
        const fullKey = parentKey ? `${parentKey}.${key}` : key;

        if (inputObj[key] !== null && typeof inputObj[key] === 'object') {
          if (Array.isArray(inputObj[key])) {
            // Si es un array, tratamos de preservarlo como array
            const arrayCopy = [];
            let arrayComplete = true;
            for (let i = 0; i < inputObj[key].length; i++) {
              if (inputObj[key][i] === null || inputObj[key][i] === '') {
                arrayComplete = false;
                arrayCopy.push('FALTA DE COMPLETAR');
                result.incompleteFields[`${fullKey}[${i}]`] =
                  typeof inputObj[key][i];
              } else {
                arrayCopy.push(inputObj[key][i]);
              }
            }
            setNestedProperty(result.completedObject, fullKey, arrayCopy);
            // Actualizamos allFieldsComplete en caso de que el array no esté completo
            result.allFieldsComplete =
              result.allFieldsComplete && arrayComplete;
          } else {
            processObject(inputObj[key], fullKey);
          }
        } else if (inputObj[key] === null || inputObj[key] === '') {
          result.allFieldsComplete = false; // Si se encuentra un campo vacío, actualizamos allFieldsComplete
          setNestedProperty(
            result.completedObject,
            fullKey,
            'FALTA DE COMPLETAR',
          );
          result.incompleteFields[fullKey] = typeof inputObj[key];
          inputObj[key] = 'FALTA DE COMPLETAR';
        } else {
          setNestedProperty(result.completedObject, fullKey, inputObj[key]);
        }
      }
    };

    processObject(obj);

    // Aquí agregamos las claves faltantes
    const addRemainingKeys = (inputObj: any, parentKey: string = '') => {
      for (const key in inputObj) {
        const fullKey = parentKey ? `${parentKey}.${key}` : key;
        if (inputObj[key] !== null && typeof inputObj[key] === 'object') {
          if (Array.isArray(inputObj[key])) {
            setNestedProperty(result.completedObject, fullKey, inputObj[key]);
          } else {
            addRemainingKeys(inputObj[key], fullKey);
          }
        } else {
          setNestedProperty(result.completedObject, fullKey, inputObj[key]);
        }
      }
    };

    // Llamada para agregar las claves faltantes
    addRemainingKeys(obj);

    return result;
  }

  private findKeyInAllProperties(data: any, key: string) {
    const normalizedKey = key.trim().toLowerCase();
    let foundValue = null;
    /* 
            Solamente se recorren las keys de
            primer nivel
        */
    for (const prop in data) {
      if (data[prop] && typeof data[prop] === 'object') {
        for (const innerKey in data[prop]) {
          const normalizedInnerKey = innerKey.trim().toLowerCase();
          if (normalizedInnerKey === normalizedKey) {
            foundValue = data[prop][innerKey];
            /* 
                            Se busca en los nodos main y others
                            como prioridad
                        */
            if (prop === 'main' || prop === 'others') {
              return foundValue;
            }
          }
        }
      }
    }
    return foundValue;
  }

  private findPropInApendice(prop: string) {
    return this.findKeyInAllProperties(this.apendiceBuiled, prop);
  }

  public findInObjectByKey<T>(
    obj: any,
    searchKeys: string | string[],
    processor?: (value: string) => T,
  ): T[] {
    let results: T[] = [];
    const keysArray = Array.isArray(searchKeys)
      ? searchKeys.map((k) => k.toLowerCase())
      : [searchKeys.toLowerCase()];
    const normalizeString = (str: string): string => {
      return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Elimina tildes
        .replace(/[^a-z0-9\s]/g, ' ') // Reemplaza caracteres especiales con espacio
        .replace(/\s+/g, ' ') // Reemplaza múltiples espacios por uno solo
        .trim();
    };

    // Función auxiliar para procesar un valor encontrado
    const processValue = (value: any) => {
      const normalizedValue = normalizeString(value.toString());
      // Verificar si hay coincidencia directa o indirecta (substring)
      if (keysArray.some((searchKey) => normalizedValue.includes(searchKey))) {
        results.push(processor ? processor(value) : (value as unknown as T));
      }
    };
    if (typeof obj === 'string') {
      processValue(obj);
    } else if (typeof obj === 'number' || typeof obj === 'boolean') {
      processValue(obj);
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        results = results.concat(
          this.findInObjectByKey(item, searchKeys, processor),
        );
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          results = results.concat(
            this.findInObjectByKey(value, searchKeys, processor),
          );
        }
      }
    }

    return results.flat() as T[];
  }

  private cleanValidateAndGetSearchBy(
    config: PropertyConfig,
    invalidSearchTypes: FindTypesDte[],
  ): FindTypesDte[] {
    // Asegura que `searchBy` sea un array
    config.searchBy = Array.isArray(config.searchBy)
      ? config.searchBy
      : [config.searchBy];

    // Si 'ALL' está en searchBy, se usan todos los tipos, pero se filtran los inválidos
    if (config?.searchBy?.includes(FindTypesDte.ALL)) {
      config.searchBy = Object.values(FindTypesDte).filter(
        (type) =>
          !invalidSearchTypes.includes(type) &&
          type !== FindTypesDte.ALL &&
          type !== FindTypesDte.NOT_SEARCH,
      );
    }

    // Validar que no se usen tipos inválidos
    if (config?.searchBy?.some((type) => invalidSearchTypes.includes(type))) {
      throw new Error(
        `No puedes usar ${invalidSearchTypes.join(', ')} en searchBy porque son parsers.`,
      );
    }

    return config.searchBy;
  }

  private async findValueAllValuesWithTheConfig(
    prop: string,
    memo = new Map<string, any>(),
  ): Promise<{ allResults: Record<FindTypesDte, any>; finalValue: any }> {
    if (memo.has(prop)) {
      return {
        allResults: {} as Record<FindTypesDte, any>,
        finalValue: memo.get(prop),
      };
    }

    const propertyConfig = await this.getPropertyConfig();
    const config: PropertyConfig | undefined = propertyConfig[prop];

    if (!config) {
      console.log('No se definió la prop ' + prop + ' en la configuración.');
      return { allResults: {} as Record<FindTypesDte, any>, finalValue: null };
    }

    const results: Record<FindTypesDte, any> = this.initializeResults();
    const invalidSearchTypes = [
      FindTypesDte.CUSTOM_FUNCTION,
      FindTypesDte.CUSTOM_FUNCTION_WHEN_FIND_IN_DTE,
      FindTypesDte.SET_AND_TRY_PARSER_ENUM_OBJECT,
    ];

    //  console.log("La propiedad " + prop + " inició con la configuración: ", config);
    config.searchBy = this.cleanValidateAndGetSearchBy(
      config,
      invalidSearchTypes,
    );

    if (!config?.searchBy?.includes(FindTypesDte.NOT_SEARCH)) {
      await this.processSearches(prop, config, results);
    }

    let finalValue = await this.processParsers(config, results);

    if (!finalValue && config.defaultValue && !config.defaultPriority) {
      finalValue = config.defaultValue;
    }

    //  console.log("La propiedad " + prop + " terminó con la configuración: ", config);
    const returnO = { allResults: results, finalValue };
    //console.log(`Para la prop ${prop} estos fueron sus resultados: `, returnO);

    if (finalValue === null && config.throwError) {
      this.errorLogsInSearchAndParsers.push(config.throwError);
    }

    memo.set(prop, finalValue);
    return returnO;
  }

  private initializeResults(): Record<FindTypesDte, any> {
    return {
      [FindTypesDte.DIRECT_KEY]: null,
      [FindTypesDte.All_VALUES_OBJECT]: null,
      [FindTypesDte.APPENDICE]: null,
      [FindTypesDte.CUSTOM_FUNCTION]: null,
      [FindTypesDte.CUSTOM_FUNCTION_WHEN_FIND_IN_DTE]: null,
      [FindTypesDte.SET_AND_TRY_PARSER_ENUM_OBJECT]: null,
      [FindTypesDte.DEFAULT_VALUE_IN_CONFIG]: null,
      [FindTypesDte.ALL]: null,
      [FindTypesDte.NOT_SEARCH]: null,
    };
  }

  private async processSearches(
    prop: string,
    config: PropertyConfig,
    results: Record<FindTypesDte, any>,
  ) {
    if (config?.setDirectKeyFromDTE) {
      const result = this.getValueByPath(
        this.obJectDte,
        config.setDirectKeyFromDTE,
      );
      results[FindTypesDte.DIRECT_KEY] = result ?? null;
    }

    if (config?.permutations) {
      if (!config.permutations.includes(prop)) {
        config.permutations.push(prop);
      }
      for (const permutation of config.permutations) {
        const result = this.findPropInApendice(permutation);
        if (result) {
          results[FindTypesDte.APPENDICE] = result;
          break;
        }
      }
    } else {
      const result = this.findPropInApendice(prop);
      results[FindTypesDte.APPENDICE] = result ?? null;
    }

    const appendiceResult = this.findInObjectByKey(this.obJectDte, [
      prop,
      ...(config?.permutations || []),
    ])[0];
    results[FindTypesDte.All_VALUES_OBJECT] = appendiceResult ?? null;

    if (config.defaultPriority) {
      results[FindTypesDte.DEFAULT_VALUE_IN_CONFIG] = config.defaultValue;
      config.searchBy = [FindTypesDte.DEFAULT_VALUE_IN_CONFIG];
      config.searchBy = this.cleanValidateAndGetSearchBy(config, []);
    }
  }

  private async processParsers(
    config: PropertyConfig,
    results: Record<FindTypesDte, any>,
  ): Promise<any> {
    let finalValue: any = null;

    for (const searchType of config.searchBy) {
      if (searchType === FindTypesDte.NOT_SEARCH) {
        if (config?.customFunctionGetExternalDataObject) {
          finalValue = await this.executeCustomFunction(config);
          results[FindTypesDte.CUSTOM_FUNCTION] = finalValue;
        }
        finalValue = await this.applyParsers(config, finalValue, results);
        results[searchType] = finalValue;
        break;
      }

      const searchResult = results[searchType];
      finalValue = searchResult;
      const customFunction = await this.executeCustomFunction(config);
      if (!finalValue) {
        finalValue = customFunction;
      }
      finalValue = await this.applyParsers(config, finalValue, results);
      if (finalValue) {
        break;
      }
    }
    return finalValue;
  }

  private async executeCustomFunction(config: PropertyConfig): Promise<any> {
    if (!config.customFunctionGetExternalDataObject) return null;

    const { function: externalFunction, parameters } =
      config.customFunctionGetExternalDataObject;
    try {
      // Usamos Promise.all para esperar las promesas
      const paramValues = await Promise.all(
        Object.keys(parameters).map((key) => {
          const value = parameters[key];
          return typeof value === 'function' ? value() : value;
        }),
      );
      console.log('Valores de parámetros:', paramValues);
      return await externalFunction(...paramValues);
    } catch (error) {
      console.error('Error en customFunction:', error);
      return null;
    }
  }

  private async applyParsers(
    config: PropertyConfig,
    value: any,
    results: Record<FindTypesDte, any>,
  ): Promise<any> {
    if (config?.customFunctionWhenFindInDTE && value !== null) {
      const parsedResult = await config.customFunctionWhenFindInDTE(value);
      results[FindTypesDte.CUSTOM_FUNCTION_WHEN_FIND_IN_DTE] = parsedResult;
      value = parsedResult;
    }

    if (config.setAndTryParserObject && value !== null) {
      const parsedResult = this.buildTypeFromEnum(
        value,
        config.setAndTryParserObject,
      );
      results[FindTypesDte.SET_AND_TRY_PARSER_ENUM_OBJECT] = parsedResult;
      value = parsedResult;
    }

    return value;
  }

  private async findValue(prop: string, memo = new Map<string, any>()) {
    const findData = await this.findValueAllValuesWithTheConfig(prop, memo);
    // console.log("para la prop " + prop + " esta es la find data: ", findData);
    return findData.finalValue;
  }

  private getValueByPath(obj: any, path: string): any {
    const keys = path.replace(/\[(\w+)\]/g, '.$1').split('.'); // Convierte algo como 'cuerpoDocumento[0].descripcion' en ['cuerpoDocumento', '0', 'descripcion']
    return keys.reduce((acc, key) => (acc ? acc[key] : undefined), obj);
  }

  public async build(): Promise<CreateShipmentDto | any> {
    const main = new CSVEncoderApendice('main', {
      licencia: '221311232P',
      placa_remolque: 'JJEKWK',
      tipo_operacion: 'C',
      tipo_carga: 'G',
      tipo_camion: 'V',
    });

    const others = new CSVEncoderApendice('others', {
      require_barrido: 'N',
      marchamos: ['34234', '23213'],
    });

    // console.log("otros, ", others.toJSON());
    //  console.log("main, ", main.toJSON());
    // Asignación de datos en el objeto de envío
    this.shipmentDocument.codigo_gen = await this.findValue('code_gen');
    this.shipmentDocument.producto = await this.findValue('producto');
    this.shipmentDocument.tipo_operacion =
      await this.findValue('tipo_operacion');
    this.shipmentDocument.tipo_carga = await this.findValue('tipo_carga');
    this.shipmentDocument.vehiculo.motorista.licencia =
      await this.findValue('licencia');
    this.shipmentDocument.vehiculo.motorista.nombre =
      await this.findValue('motorista');
    this.shipmentDocument.vehiculo.placa = await this.findValue('placa');
    this.shipmentDocument.vehiculo.placa_remolque =
      await this.findValue('placa_remolque');
    this.shipmentDocument.vehiculo.tipo_camion =
      await this.findValue('tipo_camion');
    this.shipmentDocument.transportista.nombre =
      await this.findValue('transportista');
    this.shipmentDocument.codigo_ingenio =
      await this.findValue('codigo_ingenio');
    this.shipmentDocument.cantidad_producto =
      await this.findValue('cantidad_producto');
    this.shipmentDocument.unidad_medida = await this.findValue('unidad_medida');
    this.shipmentDocument.require_barrido =
      await this.findValue('require_barrido');
    this.shipmentDocument.marchamos = await this.findValue('marchamos');
    this.shipmentDocument.peso_bruto = await this.findValue('peso_bruto');
    this.shipmentDocument.peso_tara = await this.findValue('peso_tara');

    // ===== NUEVO: Peso1 → peso_bruto =====
    this.shipmentDocument.peso_bruto = await this.findPropAgain('peso_bruto', {
      searchBy: [FindTypesDte.APPENDICE, FindTypesDte.All_VALUES_OBJECT],
      permutations: ['Peso1', 'peso1', 'Peso Bruto', 'peso bruto', 'bruto'],
      customFunctionWhenFindInDTE: async (pesoBruto) => {
        pesoBruto = Array.isArray(pesoBruto) ? pesoBruto.join('') : pesoBruto;
        if (!pesoBruto) return null;

        // Buscar número después de ":" y antes de una unidad de medida
        const regex = /:\s*([\d.,]+)\s*\w+/;
        const match = pesoBruto.match(regex);
        if (match) {
          const number = parseFloat(match[1].replace(/,/g, ''));
          return isNaN(number) ? null : number;
        }
        // Intentar convertirlo a número directamente si no coincide con el formato anterior
        const number = parseFloat(pesoBruto.toString().replace(/,/g, ''));
        return isNaN(number) ? null : number;
      },
    });

    // ===== NUEVO: Peso2 → peso_tara =====
    this.shipmentDocument.peso_tara = await this.findPropAgain('peso_tara', {
      searchBy: [FindTypesDte.APPENDICE, FindTypesDte.All_VALUES_OBJECT],
      permutations: ['Peso2', 'peso2', 'Peso Tara', 'peso tara', 'tara'],
      customFunctionWhenFindInDTE: async (pesoTara) => {
        pesoTara = Array.isArray(pesoTara) ? pesoTara.join('') : pesoTara;
        if (!pesoTara) return null;

        // Buscar número después de ":" y antes de una unidad de medida
        const regex = /:\s*([\d.,]+)\s*\w+/;
        const match = pesoTara.match(regex);
        if (match) {
          const number = parseFloat(match[1].replace(/,/g, ''));
          return isNaN(number) ? null : number;
        }
        // Intentar convertirlo a número directamente si no coincide con el formato anterior
        const number = parseFloat(pesoTara.toString().replace(/,/g, ''));
        return isNaN(number) ? null : number;
      },
    });

    // 🔍 Validaciones especiales para producto MELAZA
    if (this.shipmentDocument.producto === 'MEL-001') {
      const tipoCamion = this.shipmentDocument.vehiculo.tipo_camion;
      const marchamos = this.shipmentDocument.marchamos;

      // Log de inicio de validación para MELAZA
      if (this.ingenioLogsService && this.shouldLogIngenio()) {
        console.log('Iniciando validaciones para producto MELAZA');
      }

      // Validar tipo de camión
      if (tipoCamion !== 'P') {
        // Log de error antes de lanzar excepción
        if (this.ingenioLogsService && this.shouldLogIngenio()) {
          await this.ingenioLogsService.logIngenioError(
            this.shipmentDocument.codigo_gen,
            this.generateUsernameForLog(),
            '400',
            "Para Melaza solo se permite tipo de camión 'P' (Pipa).",
            {
              expectedTruckType: 'P',
              receivedTruckType: tipoCamion,
              producto: this.shipmentDocument.producto,
              shipmentData: this.shipmentDocument,
            },
          );
        }

        throw new BadRequestException({
          message: "Para Melaza solo se permite tipo de camión 'P' (Pipa).",
          logs: { tipoCamion },
        });
      }

      // Validar solo 1 marchamo
      if (Array.isArray(marchamos) && marchamos.length !== 1) {
        // Log de error antes de lanzar excepción
        if (this.ingenioLogsService && this.shouldLogIngenio()) {
          await this.ingenioLogsService.logIngenioError(
            this.shipmentDocument.codigo_gen,
            this.generateUsernameForLog(),
            '400',
            'Para Melaza solo se permite un marchamo.',
            {
              expectedSealsCount: 1,
              receivedSealsCount: marchamos.length,
              marchamos: marchamos,
              producto: this.shipmentDocument.producto,
              shipmentData: this.shipmentDocument,
            },
          );
        }

        throw new BadRequestException({
          message: 'Para Melaza solo se permite un marchamo.',
          logs: { marchamos },
        });
      }

      // Forzar barrido como NO
      this.shipmentDocument.require_barrido = RequiresSweepingType.NO;

      // Log de éxito para validaciones de MELAZA
      if (this.ingenioLogsService && this.shouldLogIngenio()) {
        console.log('Terminando validaciones para producto MELAZA');
      }
    }

    console.log('Este es el shipment: ', this.shipmentDocument);
    const checkfields = this.fillEmptyFields(this.shipmentDocument);

    console.log('esto es check: ', checkfields);

    if (!checkfields.allFieldsComplete) {
      // Log de error para campos incompletos
      if (this.ingenioLogsService && this.shouldLogIngenio()) {
        await this.ingenioLogsService.logIngenioError(
          this.shipmentDocument.codigo_gen,
          this.generateUsernameForLog(),
          '400',
          'No se encontraron todos los campos en el mapper',
          {
            incompleteFields: checkfields.incompleteFields,
            errorLogs: checkfields.errorLogsInSearchAndParsers,
            shipmentData: this.shipmentDocument,
          },
        );
      }

      throw new BadRequestException({
        message: 'No se encontraron todos los campos',
        logs: checkfields,
      });
    }

    // Log de éxito para mapper completo
    if (this.ingenioLogsService && this.shouldLogIngenio()) {
      console.log('Mapper completado exitosamente');
    }

    console.log('esto es lo que se mapea: ', this.shipmentDocument);
    return this.shipmentDocument;
  }
}
