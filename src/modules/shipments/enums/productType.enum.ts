import { createEnumMap } from "src/utils/functions.util";

export enum ProductType {
    AZUCAR_CRUDO_GRANEL = 'AZ-001',
    AZUCAR_REFINO_EN_SACO = 'AZ-002',
    AZUCAR_BLANCA_EN_SACO = 'AZ-003',
    AZUCAR_CRUDO_ENVASADA = 'AZ-004',
    MELAZA = 'MEL-001',
    OTRO = "O"
}

/* 
    Pasar como segundo parametro un false significa 
    que no va a tratar de crear codigos, si no
    va a tomar los codigos que ya estan
*/
export const typeProductMap = createEnumMap(ProductType, false);
