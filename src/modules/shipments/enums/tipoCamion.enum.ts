import { createEnumMap } from 'src/utils/functions.util';

export enum TipoCamion {
  VOLTEO = 'V',
  RASTRA = 'R',
  PIPA = 'P',
}

export const TipoCamionMap = createEnumMap(TipoCamion);

export function getTipoCamionByLetter(letter: string): string | undefined {
  const normalizedLetter = letter.toLowerCase();
  const letterMap = Object.values(TipoCamion).reduce(
    (acc, value) => {
      acc[value[0].toLowerCase()] = value;
      return acc;
    },
    {} as { [key: string]: string },
  );

  const result = letterMap[normalizedLetter];
  return result ? result.charAt(0).toUpperCase() + result.slice(1) : undefined;
}
