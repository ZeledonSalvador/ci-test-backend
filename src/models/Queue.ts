import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Shipments } from './Shipments';

@Index('PK__Queue__3213E83F4D42E342', ['id'], { unique: true })
@Entity('Queue', { schema: 'dbo' })
export class Queue {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('nvarchar', { name: 'type', length: 20 })
  type: string;

  @Column('nvarchar', {
    name: 'status',
    length: 20,
    default: () => "'waiting'",
  })
  status: string;

  @Column('datetime', {
    name: 'entryTime',
    nullable: true,
    default: () => 'getdate()',
  })
  entryTime: Date | null;

  @ManyToOne(() => Shipments, (shipments) => shipments.queues, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'shipment_codeGen', referencedColumnName: 'codeGen' }])
  shipmentCodeGen: Shipments;
}
