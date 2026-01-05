// src/models/Marchamos.ts
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Shipments } from './Shipments';
import { SealSeries } from './SealSeries';

@Index('PK_Marchamos', ['id'], { unique: true })
@Entity('Marchamos', { schema: 'dbo' })
export class Marchamos {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  // Relación con el envío (id_shipment en la tabla)
  @ManyToOne(() => Shipments, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'id_shipment', referencedColumnName: 'id' }])
  shipment: Shipments;

  // Relación opcional con la serie de sellos (id_sealseries en la tabla)
  @ManyToOne(() => SealSeries, { nullable: true })
  @JoinColumn([{ name: 'id_sealseries', referencedColumnName: 'id' }])
  sealSeries: SealSeries | null;

  @Column('nvarchar', { name: 'seal_code', length: 50 })
  sealCode: string;

  @Column('int', { name: 'status', nullable: true })
  status: number;

  @Column('datetime', {
    name: 'created_at',
    nullable: true,
    default: () => 'getdate()',
  })
  createdAt: Date | null;

  @Column('nvarchar', { name: 'motivo', length: 200, nullable: true })
  motivo: string | null;
}
