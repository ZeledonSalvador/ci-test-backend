export type TransformedData<T extends string> = {
  [K in T]: {
    [key: string]: string | null;
  };
};


export interface PropertyConfig {
  setDirectKeyFromDTE?: string;
  permutations?: string[];
  customFunctionGetExternalDataObject?: {
    function: (...args: any[]) => Promise<any> | any;
    parameters: Record<string, any>;
  };
  customFunctionWhenFindInDTE?: (value: any) => any;
  setAndTryParserObject?: any;
  defaultValue?: any;
  defaultPriority?: boolean;
  searchBy : FindTypesDte[] | FindTypesDte;
  throwError? : string
}

export enum FindTypesDte {
  DIRECT_KEY = "directKey",
  APPENDICE = "appendice",
  All_VALUES_OBJECT = "allValuesObject",
  CUSTOM_FUNCTION = "customFunction",
  CUSTOM_FUNCTION_WHEN_FIND_IN_DTE = "customFunctionWhenFindInDTE",
  SET_AND_TRY_PARSER_ENUM_OBJECT = "setAndTryParserEnumObject",
  DEFAULT_VALUE_IN_CONFIG = "defaultValueInConfig",
  ALL = "all",
  NOT_SEARCH = "noSearch"
}

