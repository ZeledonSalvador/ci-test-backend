// src/utils/product.utils.ts
import { ProductType } from '../enums/productType.enum';

/**
 * Obtener nombre del producto a partir del código
 * @param productCode Código del producto
 * @returns Nombre del producto o 'N/A' si no se encuentra
 */
export function getProductNameByCode(productCode: string): string {
  const productName = Object.keys(ProductType).find(
    (key) => ProductType[key as keyof typeof ProductType] === productCode,
  );
  if (productName) return productName;
  return 'N/A';
}
