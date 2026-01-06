import {
  Column,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InternalUsers } from './InternalUsers';

@Index('PK_UserWeighbridges', ['id'], { unique: true })
@Index('UQ_UserWeighbridge', ['idUser', 'weighbridgeId'], { unique: true })
@Index('IX_UserWeighbridges_User', ['idUser'])
@Index('IX_UserWeighbridges_Weighbridge', ['weighbridgeId'])
@Entity('UserWeighbridges', { schema: 'dbo' })
export class UserWeighbridges {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'id_user' })
  idUser: number;

  @Column('int', { name: 'weighbridge_id' })
  weighbridgeId: number;

  @Column('nvarchar', { name: 'weighbridge_name', nullable: true, length: 100 })
  weighbridgeName: string | null;

  @Column('bit', { name: 'active', default: true })
  active: boolean;

  @Column('datetime', {
    name: 'created_at',
    default: () => 'getdate()',
  })
  createdAt: Date;

  @Column('datetime', {
    name: 'updated_at',
    default: () => 'getdate()',
  })
  updatedAt: Date;

  @ManyToOne(() => InternalUsers, (user) => user.weighbridges)
  @JoinColumn({ name: 'id_user' })
  user: InternalUsers;
}
