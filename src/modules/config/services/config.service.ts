import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from 'src/models/SystemConfig';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  // Sistema de caché con TTL de 24 horas
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

  constructor(
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepo: Repository<SystemConfig>,
  ) {}

  /**
   * Helper: Obtiene datos del caché si son válidos
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    const age = now - cached.timestamp;

    if (age > this.CACHE_TTL_MS) {
      // Cache expirado, limpiar
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Helper: Guarda datos en el caché
   */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Helper: Invalida una clave específica o todas las claves con un prefijo
   */
  private invalidateCache(keyOrPrefix: string): void {
    if (keyOrPrefix.endsWith('*')) {
      // Invalidar todas las claves que empiecen con el prefijo
      const prefix = keyOrPrefix.slice(0, -1);
      const keysToDelete: string[] = [];

      this.cache.forEach((_, key) => {
        if (key.startsWith(prefix)) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach((key) => this.cache.delete(key));
    } else {
      // Invalidar clave específica
      this.cache.delete(keyOrPrefix);
    }
  }

  /**
   * Obtiene un valor de configuración como string
   * @param key - Clave de configuración
   * @param defaultValue - Valor por defecto si no existe
   */
  async getString(key: string, defaultValue: string = ''): Promise<string> {
    const cacheKey = `config_${key}`;

    // Intentar obtener del caché
    const cached = this.getFromCache<string>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const config = await this.systemConfigRepo.findOne({
        where: { config_key: key },
      });

      const value = config?.config_value ?? defaultValue;

      // Guardar en caché
      this.setCache(cacheKey, value);

      return value;
    } catch (error) {
      this.logger.error(
        `Error al obtener configuración ${key}: ${error.message}`,
      );
      return defaultValue;
    }
  }

  /**
   * Obtiene un valor de configuración como número
   * @param key - Clave de configuración
   * @param defaultValue - Valor por defecto si no existe
   */
  async getNumber(key: string, defaultValue: number = 0): Promise<number> {
    const stringValue = await this.getString(key, String(defaultValue));
    const numberValue = parseInt(stringValue, 10);
    return isNaN(numberValue) ? defaultValue : numberValue;
  }

  /**
   * Obtiene un valor de configuración como booleano
   * @param key - Clave de configuración
   * @param defaultValue - Valor por defecto si no existe
   */
  async getBoolean(
    key: string,
    defaultValue: boolean = false,
  ): Promise<boolean> {
    const stringValue = await this.getString(key, String(defaultValue));
    const lowerValue = stringValue.toLowerCase();
    return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes';
  }

  /**
   * Actualiza un valor de configuración
   * @param key - Clave de configuración
   * @param value - Nuevo valor
   */
  async set(key: string, value: string): Promise<void> {
    try {
      let config = await this.systemConfigRepo.findOne({
        where: { config_key: key },
      });

      if (config) {
        config.config_value = value;
        config.updated_at = new Date();
      } else {
        config = this.systemConfigRepo.create({
          config_key: key,
          config_value: value,
          description: null,
        });
      }

      await this.systemConfigRepo.save(config);

      // Invalidar caché para esta clave
      this.invalidateCache(`config_${key}`);
    } catch (error) {
      this.logger.error(
        `Error al actualizar configuración ${key}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Obtiene todas las configuraciones
   */
  async getAll(): Promise<SystemConfig[]> {
    const cacheKey = 'config_all';

    // Intentar obtener del caché
    const cached = this.getFromCache<SystemConfig[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const configs = await this.systemConfigRepo.find();

      // Guardar en caché
      this.setCache(cacheKey, configs);

      return configs;
    } catch (error) {
      this.logger.error(
        `Error al obtener todas las configuraciones: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Invalida todo el caché de configuración
   */
  clearCache(): void {
    this.invalidateCache('config_*');
    this.logger.log('Caché de configuración limpiado');
  }
}
