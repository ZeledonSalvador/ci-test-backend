import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Shipments } from './Shipments';

@Entity({ name: 'ShipmentWeight' }) // 👈 nombre exacto de la tabla
export class ShipmentWeight {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @ManyToOne(() => Shipments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_shipment' })
  shipment: Shipments;

  @Column({
    name: 'peso_in',
    type: 'decimal',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  pesoin: number | null;

  @Column({ name: 'datetime_in', type: 'datetime', nullable: true })
  datetime_in: Date | null;

  @Column({
    name: 'peso_out',
    type: 'decimal',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  pesoout: number | null;

  @Column({ name: 'datetime_out', type: 'datetime', nullable: true })
  datetime_out: Date | null;

  @Column({
    name: 'peso_neto',
    type: 'decimal',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  pesoneto: number | null;

  @Column({ name: 'bascula_in', type: 'nvarchar', length: 100, nullable: true })
  bascula_in: string | null;

  @Column({ name: 'bascula_out', type: 'nvarchar', length: 100, nullable: true })
  bascula_out: string | null;

  @Column({ name: 'id_nav_record', type: 'int', nullable: true })
  id_nav_record: number | null;
}
