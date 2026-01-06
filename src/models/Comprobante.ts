import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SerialComprobante } from './SerialComprobante';

@Entity('Comprobante', { schema: 'dbo' }) // 👈 coincide con ingenioapi.dbo.Comprobante
export class Comprobante {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'id_shipment', nullable: true })
  idShipment: number;

  @Column('nvarchar', { name: 'no_comprobante', length: 50 })
  noComprobante: number;

  @Column('int', { name: 'status', nullable: true })
  status: number;

  @Column('datetime', {
    name: 'created_at',
    default: () => 'getdate()',
  })
  createdAt: Date;

  @Column('bit', { name: 'impreso', default: () => 0 })
  impreso: boolean;

  @Column('datetime', { name: 'fecha_impresion', nullable: true })
  fechaImpresion: Date | null;

  @Column('nvarchar', { name: 'motivo', length: 200, nullable: true })
  motivo: string | null;

  @Column('int', { name: 'id_comprobseries', nullable: true })
  idComprobseries: number | null;

  @ManyToOne(() => SerialComprobante, { nullable: true })
  @JoinColumn({ name: 'id_comprobseries' })
  serialComprobante: SerialComprobante | null;
}
