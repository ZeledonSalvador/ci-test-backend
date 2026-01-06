import { createEnumMap } from 'src/utils/functions.util';

export enum TipoOperacion {
  CARGA = 'C',
  DESCARGA = 'D',
}

export const TipoOperacionMap = createEnumMap(TipoOperacion);
