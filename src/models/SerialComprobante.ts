// src/models/SerialComprobante.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'SerialComprobante' })
export class SerialComprobante {
  @PrimaryGeneratedColumn()
  id: number;

  // Id numérico de la báscula (tabla Basculas)
  @Column({ type: 'int' })
  id_bascula: number;

  @Column({ type: 'int' })
  min_serialnumber: number;

  @Column({ type: 'int' })
  max_serialnumber: number;

  @Column({ type: 'int', nullable: true })
  numero_caja: number | null;

  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
    default: () => 'GETDATE()',
  })
  created_at: Date;
}
