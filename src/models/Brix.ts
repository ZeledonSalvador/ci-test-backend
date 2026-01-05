import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Shipments } from './Shipments';

@Entity({ name: 'Brix' })
export class Brix {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  shipment_id: number;

  @ManyToOne(() => Shipments, s => s.brixLogs, { onDelete: 'CASCADE' }) // <- usa 'brixLogs'
  @JoinColumn({ name: 'shipment_id' })
  shipment: Shipments;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  brix: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at', default: () => 'GETDATE()' })
  created_at: Date;
}
