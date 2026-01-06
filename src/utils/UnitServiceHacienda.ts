interface Unit {
  name: string;
  abbreviation: string;
}

export default class UnitService {
  private static units: Record<number, Unit> = {
    // Longitud y Área
    13: { name: 'metro cuadrado', abbreviation: 'm²' },
    15: { name: 'Vara cuadrada', abbreviation: 'vq²' },

    // Volumen y Capacidad
    18: { name: 'metro cúbico', abbreviation: 'm³' },
    20: { name: 'Barril', abbreviation: 'bbl' },
    22: { name: 'Galón', abbreviation: 'gal' },
    23: { name: 'Litro', abbreviation: 'L' },
    24: { name: 'Botella', abbreviation: 'bot' },
    26: { name: 'Mililitro', abbreviation: 'ml' },

    // Peso y Masa
    30: { name: 'Tonelada', abbreviation: 't' },
    32: { name: 'Quintal', abbreviation: 'qq' },
    33: { name: 'Arroba', abbreviation: 'arroba' },
    34: { name: 'Kilogramo', abbreviation: 'kg' },
    36: { name: 'Libra', abbreviation: 'lb' },
    37: { name: 'Onza troy', abbreviation: 'oz t' },
    38: { name: 'Onza', abbreviation: 'oz' },
    39: { name: 'Gramo', abbreviation: 'g' },
    40: { name: 'Miligramo', abbreviation: 'mg' },

    // Energía y Potencia
    42: { name: 'Megawatt', abbreviation: 'MW' },
    43: { name: 'Kilowatt', abbreviation: 'kW' },
    44: { name: 'Watt', abbreviation: 'W' },
    45: { name: 'Megavoltio-amperio', abbreviation: 'MVA' },
    46: { name: 'Kilovoltio-amperio', abbreviation: 'kVA' },
    47: { name: 'Voltio-amperio', abbreviation: 'VA' },
    49: { name: 'Gigawatt-hora', abbreviation: 'GWh' },
    50: { name: 'Megawatt-hora', abbreviation: 'MWh' },
    51: { name: 'Kilowatt-hora', abbreviation: 'kWh' },
    52: { name: 'Watt-hora', abbreviation: 'Wh' },

    // Electricidad
    53: { name: 'Kilovoltio', abbreviation: 'kV' },
    54: { name: 'Voltio', abbreviation: 'V' },

    // Cantidad
    55: { name: 'Millar', abbreviation: 'mil' },
    56: { name: 'Medio millar', abbreviation: 'medio mil' },
    57: { name: 'Ciento', abbreviation: 'cien' },
    58: { name: 'Docena', abbreviation: 'doc' },
    59: { name: 'Unidad', abbreviation: 'u' },

    // Otros
    99: { name: 'Otra', abbreviation: 'otra' },
  };

  static getUnit(code: number): Unit {
    return (
      this.units[code] ?? { name: 'Código no encontrado', abbreviation: '' }
    );
  }
}
