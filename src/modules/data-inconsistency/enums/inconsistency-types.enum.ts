import { createEnumMap } from 'src/utils/functions.util';

export enum InconsistencyType {
  PRECHECK = 'PRECHECK',
  SEALS = 'SEALS',
}

/* 
    Pasar como segundo parametro un false significa
    que no va a tratar de crear codigos, si no
    va a tomar los codigos que ya estan
*/
export const inconsistencyTypeMap = createEnumMap(InconsistencyType, false);
