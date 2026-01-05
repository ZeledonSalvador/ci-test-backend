// src/models/ProductIngenioBlock.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity({ name: 'ProductIngenioBlock', schema: 'dbo' })
@Unique('UQ_ProductIngenioBlock_pair', ['ingenioCode', 'productCode']) // único por par
export class ProductIngenioBlock {
  @PrimaryGeneratedColumn()
  id: number; // INT IDENTITY(1,1)

  @Index()
  @Column({ type: 'varchar', length: 50 })
  ingenioCode: string; // VARCHAR(50) NOT NULL

  @Index()
  @Column({ type: 'varchar', length: 50 })
  productCode: string; // VARCHAR(50) NOT NULL

  @Index()
  @Column({ type: 'bit', default: () => '0' })
  active: boolean; // BIT NOT NULL DEFAULT 0

  @CreateDateColumn({ type: 'datetime2', default: () => 'SYSUTCDATETIME()' })
  createdAt: Date; // DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()

  @UpdateDateColumn({ type: 'datetime2', default: () => 'SYSUTCDATETIME()' })
  updatedAt: Date; // DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
}
