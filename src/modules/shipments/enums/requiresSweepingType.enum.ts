import { createEnumMap } from 'src/utils/functions.util';

export enum RequiresSweepingType {
  SI = 'S',
  NO = 'N',
}

export const RequiresSweepingMap = createEnumMap(RequiresSweepingType);
