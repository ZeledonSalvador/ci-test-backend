import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LeveransUsers } from './LeveransUsers';
import { LeveransUserLoginHistory } from './LeveransUserLoginHistory';
import { PredefinedStatuses } from './PredefinedStatuses';
import { Shipments } from './Shipments';

@Index('PK__Leverans__3213E83F8DD989E3', ['id'], { unique: true })
@Entity('LeveransLogger', { schema: 'dbo' })
export class LeveransLogger {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('nvarchar', { name: 'action', length: 50 })
  action: string;

  @Column('datetime', {
    name: 'created_at',
    nullable: true,
    default: () => 'getdate()',
  })
  createdAt: Date | null;

  @ManyToOne(
    () => LeveransUsers,
    (leveransUsers) => leveransUsers.leveransLoggers,
  )
  @JoinColumn([{ name: 'leverans_user_id', referencedColumnName: 'id' }])
  leveransUser: LeveransUsers;

  @ManyToOne(
    () => LeveransUserLoginHistory,
    (leveransUserLoginHistory) => leveransUserLoginHistory.leveransLoggers,
  )
  @JoinColumn([{ name: 'login_history_id', referencedColumnName: 'id' }])
  loginHistory: LeveransUserLoginHistory;

  @ManyToOne(
    () => PredefinedStatuses,
    (predefinedStatuses) => predefinedStatuses.leveransLoggers,
  )
  @JoinColumn([{ name: 'predefined_statuses_id', referencedColumnName: 'id' }])
  predefinedStatuses: PredefinedStatuses;

  @ManyToOne(() => Shipments, (shipments) => shipments.leveransLoggers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'shipment_id', referencedColumnName: 'id' }])
  shipment: Shipments;
}
