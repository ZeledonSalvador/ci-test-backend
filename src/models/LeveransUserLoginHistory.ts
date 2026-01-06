import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LeveransLogger } from './LeveransLogger';
import { LeveransUsers } from './LeveransUsers';

@Index('PK__Leverans__3213E83F251BA367', ['id'], { unique: true })
@Entity('LeveransUserLoginHistory', { schema: 'dbo' })
export class LeveransUserLoginHistory {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('nvarchar', { name: 'shift', length: 50 })
  shift: string;

  @Column('nvarchar', { name: 'bascula', length: 50 })
  bascula: string;

  @Column('datetime', {
    name: 'created_at',
    nullable: true,
    default: () => 'getdate()',
  })
  createdAt: Date | null;

  @OneToMany(
    () => LeveransLogger,
    (leveransLogger) => leveransLogger.loginHistory,
  )
  leveransLoggers: LeveransLogger[];

  @ManyToOne(
    () => LeveransUsers,
    (leveransUsers) => leveransUsers.leveransUserLoginHistories,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn([{ name: 'leverans_user_id', referencedColumnName: 'id' }])
  leveransUser: LeveransUsers;
}
