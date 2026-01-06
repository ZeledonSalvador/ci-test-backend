import { createEnumMap } from 'src/utils/functions.util';

export enum TipoCarga {
  GRANEL = 'G',
  SACOS = 'S',
}

export const TipoCargaMap = createEnumMap(TipoCarga);
