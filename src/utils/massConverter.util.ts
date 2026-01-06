import { MassUnit } from 'src/modules/shipments/enums/unitMeasure.enum';

export default class MassConverter {
  private conversionFactors: Record<MassUnit, number>;

  constructor() {
    this.conversionFactors = {
      [MassUnit.Gram]: 1,
      [MassUnit.Kilogram]: 1000,
      [MassUnit.Ton]: 1_000_000,
      [MassUnit.Milligram]: 0.001,
      [MassUnit.Microgram]: 0.000001,
      [MassUnit.Pound]: 453.592,
      [MassUnit.Ounce]: 28.3495,
      [MassUnit.Stone]: 6350.29,
      [MassUnit.MetricTon]: 1_000_000,
      [MassUnit.Quintal]: 100000,
    };
  }

  public convert(value: number, fromUnit: MassUnit, toUnit: MassUnit): number {
    if (value < 0) {
      throw new Error('El valor no puede ser negativo.');
    }
    const valueInGrams = value * this.conversionFactors[fromUnit];
    return valueInGrams / this.conversionFactors[toUnit];
  }
}
