import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Index('PK__SysLogs__3213E83FE3F96A1C', ['id'], { unique: true })
@Entity('SysLogs', { schema: 'dbo' })
export class SysLogs {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('nvarchar', { name: 'log_type', length: 50 })
  logType: string;

  @Column('nvarchar', {
    name: 'log_text',
    nullable: true,
    default: () => 'NULL',
  })
  logText: string | null;

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
}
