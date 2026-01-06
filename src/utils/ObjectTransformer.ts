export default class ObjectTransformer {
  private config: {
    keysToRemove?: Record<string, string[]>;
    keysToMove?: { from: string; to: string }[];
    strictMode?: boolean;
  };
  private logs: string[];

  constructor(config: {
    keysToRemove?: Record<string, string[]>;
    keysToMove?: { from: string; to: string }[];
    strictMode?: boolean;
  }) {
    this.config = config;
    this.logs = [];
  }

  public transform(data: any | any[]): any | any[] {
    if (!data) return null;
    if (Array.isArray(data)) {
      return data.map((item) => this.transform(item));
    }

    const clonedData = { ...data };

    // Eliminar claves
    if (this.config.keysToRemove) {
      Object.entries(this.config.keysToRemove).forEach(([key, fields]) => {
        if (key === 'root') {
          fields.forEach((field) => {
            if (clonedData.hasOwnProperty(field)) {
              delete clonedData[field];
            } else {
              this.handleMissingKey(field, 'delete');
            }
          });
        } else {
          this.removeNestedKeys(clonedData, key, fields);
        }
      });
    }

    // Mover claves
    if (this.config.keysToMove) {
      this.config.keysToMove.forEach(({ from, to }) => {
        this.moveKey(clonedData, from, to);
      });
    }

    return clonedData;
  }

  private moveKey(data: any, from: string, to: string) {
    if (from in data) {
      if (to === 'root') {
        const value = data[from];
        delete data[from];
        Object.assign(data, value);
      } else {
        data[to] = data[from];
        delete data[from];
      }
    } else {
      this.handleMissingKey(from, 'move');
    }
  }

  private removeNestedKeys(data: any, key: string, fields: string[]) {
    if (key in data) {
      const target = data[key];
      if (Array.isArray(target)) {
        target.forEach((item) => {
          fields.forEach((field) => {
            if (field in item) {
              delete item[field];
            } else {
              this.handleMissingKey(`${key}[item].${field}`, 'delete');
            }
          });
        });
      } else {
        fields.forEach((field) => {
          if (field in target) {
            delete target[field];
          } else {
            this.handleMissingKey(`${key}.${field}`, 'delete');
          }
        });
      }
    } else {
      this.handleMissingKey(key, 'delete parent object');
    }
  }

  private handleMissingKey(key: string, operation: string) {
    const message = `Warning: Attempted to ${operation} key '${key}', but it does not exist.`;
    this.logs.push(message);
    if (this.config.strictMode) {
      throw new Error(`Strict Mode Error: ${message}`);
    }
  }

  public getLogs(): string[] {
    return this.logs;
  }

  public static mergeConfigs(
    ...configs: Partial<ObjectTransformer['config']>[]
  ): ObjectTransformer['config'] {
    return configs.reduce(
      (acc, config) => {
        if (config.keysToRemove) {
          acc.keysToRemove = acc.keysToRemove || {};
          Object.entries(config.keysToRemove).forEach(([key, fields]) => {
            acc.keysToRemove![key] = [
              ...new Set([...(acc.keysToRemove![key] || []), ...fields]),
            ];
          });
        }

        if (config.keysToMove) {
          const existingMoves = new Set(
            acc.keysToMove?.map((move) => `${move.from}->${move.to}`),
          );
          const uniqueMoves = config.keysToMove.filter((move) => {
            const key = `${move.from}->${move.to}`;
            if (existingMoves.has(key)) return false;
            existingMoves.add(key);
            return true;
          });
          acc.keysToMove = [...(acc.keysToMove || []), ...uniqueMoves];
        }

        if (config.strictMode !== undefined) {
          acc.strictMode = config.strictMode;
        }

        return acc;
      },
      {} as ObjectTransformer['config'],
    );
  }
}
