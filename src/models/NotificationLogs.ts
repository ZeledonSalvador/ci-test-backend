// src/models/NotificationLogs.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('Notification_Logs', { schema: 'dbo' })
@Index('IDX_NotificationLogs_Status', ['status'])
@Index('IDX_NotificationLogs_SentBy', ['sentBy'])
@Index('IDX_NotificationLogs_CreatedAt', ['createdAt'])
export class NotificationLogs {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'nvarchar', length: 200, name: 'sentBy' })
  sentBy: string;

  @Column({ type: 'nvarchar', length: 200, name: 'sentTo' })
  sentTo: string;

  @Column({ type: 'nvarchar', length: 300, name: 'subject' })
  subject: string;

  @Column({
    type: 'nvarchar',
    length: 'MAX',
    nullable: true,
    name: 'emailBody',
  })
  emailBody: string | null; // JSON con los datos del template

  @Column({ type: 'nvarchar', length: 20, name: 'status' })
  status: string;

  @Column({ type: 'int', default: 1, name: 'attempts' })
  attempts: number;

  @Column({
    type: 'nvarchar',
    length: 'MAX',
    nullable: true,
    name: 'errorMessage',
  })
  errorMessage: string | null;

  @Column({ type: 'int', nullable: true, name: 'referenceId' })
  referenceId: number | null;

  @CreateDateColumn({
    type: 'datetime',
    name: 'createdAt',
    default: () => 'GETDATE()',
  })
  createdAt: Date;
}
