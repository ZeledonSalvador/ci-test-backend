// src/models/SealSeries.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'SealSeries' })
export class SealSeries {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  id_bascula: number;

  @Column({ type: 'nvarchar', length: 50 })
  min_sealnumber: string;

  @Column({ type: 'nvarchar', length: 50 })
  max_sealnumber: string;

  @Column({ type: 'nvarchar', length: 50 })
  ingenio_code: string;

  @Column({ type: 'nvarchar', length: 50 })
  product_code: string;

  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    default: () => 'GETDATE()',
  })
  created_at: Date;
}
