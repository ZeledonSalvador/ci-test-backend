import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Users } from './Users';
import { InvalidatedShipments } from './InvalidatedShipments';
import { Shipments } from './Shipments';

@Index('PK__Clients__3213E83FB3327DE4', ['id'], { unique: true })
@Index('UQ__Clients__1AF3198CA42DD74A', ['ingenioNavCode'], { unique: true })
@Index('UQ__Clients__3FFDC2F9EAA044ED', ['ingenioCode'], { unique: true })
@Entity('Clients', { schema: 'dbo' })
export class Clients {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('nvarchar', { name: 'ingenio_code', unique: true, length: 50 })
  ingenioCode: string;

  @Column('nvarchar', { name: 'ingenio_nav_code', unique: true, length: 50 })
  ingenioNavCode: string;

  @Column('nvarchar', { name: 'name', length: 100 })
  name: string;

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

  @ManyToOne(() => Users, (users) => users.clients, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: Users;

  @OneToMany(
    () => InvalidatedShipments,
    (invalidatedShipments) => invalidatedShipments.client,
  )
  invalidatedShipments: InvalidatedShipments[];

  @OneToMany(() => Shipments, (shipments) => shipments.ingenio)
  shipments: Shipments[];
}
