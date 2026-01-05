import {Entity, Column, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, JoinColumn} from 'typeorm';
import { Shipments } from './Shipments';

@Entity({ name: 'ShipmentsTemperature', schema: 'dbo' })
export class ShipmentTemperature {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  // Relación -> usa la FK real 'shipment_id'
  @ManyToOne(() => Shipments, (s) => s.shipmentTemperatures, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'shipment_id' }) // 👈 clave: mapea la FK al nombre real
  shipment: Shipments;

  @Column({ name: 'temperature', type: 'decimal', precision: 10, scale: 3 })
  temperature: number;

  // si quieres soportar el campo nullable 'comment' que existe en la tabla
  @Column({ name: 'comment', type: 'nvarchar', length: 500, nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'GETDATE()' })
  created_at: Date;
}
