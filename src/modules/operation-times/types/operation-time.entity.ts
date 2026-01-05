// src/modules/operation-times/types/operation-time.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'ShipmentsTimes', schema: 'dbo' }) 
export class OperationTime {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'shipment_id' })
  shipmentId: number;

  @Column({ name: 'operation_type', length: 20 })
  operationType: string;

  @Column({ name: 'time', type: 'time' })
  duration: string;

  @Column({ nullable: true, type: 'nvarchar', length: 255 })
  comment: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'truck_type', length: 5 })
  truckType: string;
}
