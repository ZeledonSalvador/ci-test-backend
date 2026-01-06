import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Shipments } from './Shipments';

@Index('PK__Vehicles__3213E83F04B72DFD', ['id'], { unique: true })
@Entity('Vehicles', { schema: 'dbo' })
export class Vehicles {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('nvarchar', { name: 'plate', length: 50 })
  plate: string;

  @Column('nvarchar', { name: 'trailer_plate', nullable: true, length: 50 })
  trailerPlate: string | null;

  @Column('nvarchar', { name: 'truck_type', length: 50 })
  truckType: string;

  @Column('datetime', {
    name: 'created_at',
    nullable: true,
    default: () => 'getdate()',
  })
  createdAt: Date | null;

  @Column('datetime', {
    name: 'updated_at',
    nullable: true,
    default: () => 'getdate()',
  })
  updatedAt: Date | null;

  @OneToMany(() => Shipments, (shipments) => shipments.vehicle)
  shipments: Shipments[];
}
