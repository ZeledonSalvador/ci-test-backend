import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Shipments } from './Shipments';
import { Users } from './Users';

@Index('PK__DataInconsistency__3213E83F', ['id'], { unique: true })
@Entity('DataInconsistency', { schema: 'dbo' })
export class DataInconsistency {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('nvarchar', { name: 'inconsistency_type' })
  inconsistencyType: string; // JSON data stored as string

  @Column('nvarchar', { name: 'comments', nullable: true })
  comments: string | null;

  @Column('datetime', {
    name: 'created_at',
    default: () => 'getdate()',
  })
  createdAt: Date;

  @Column('datetime', {
    name: 'updated_at',
    nullable: true,
  })
  updatedAt: Date | null;

  @ManyToOne(() => Shipments, (shipments) => shipments.dataInconsistencies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'shipment_id', referencedColumnName: 'id' }])
  shipment: Shipments;

  @ManyToOne(() => Users, (users) => users.dataInconsistencies, {
    onDelete: 'NO ACTION',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: Users;

  @Column('int', { name: 'user_id' })
  userId: number;
}
