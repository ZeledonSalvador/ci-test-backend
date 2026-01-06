import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Drivers } from './Drivers';
import { Shipments } from './Shipments';

@Index('PK__Blacklis__3213E83F26D9BB03', ['id'], { unique: true })
@Entity('BlacklistDrivers', { schema: 'dbo' })
export class BlacklistDrivers {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('nvarchar', { name: 'observation', nullable: true, length: 255 })
  observation: string | null;

  @Column('nvarchar', { name: 'severity_level', nullable: true, length: 50 })
  severityLevel: string | null;

  @Column('nvarchar', { name: 'ban_duration_days', length: 50 })
  banDurationDays: string;

  @Column('datetime', {
    name: 'created_at',
    nullable: true,
    default: () => 'getdate()',
  })
  createdAt: Date | null;

  // Nuevos campos para reportes
  @Column('datetime', { name: 'report_datetime', nullable: true })
  reportDatetime: Date | null;

  @Column('nvarchar', { name: 'event_type', nullable: true, length: 100 })
  eventType: string | null;

  @Column('nvarchar', { name: 'fault_type', nullable: true, length: 100 })
  faultType: string | null;

  @Column('nvarchar', { name: 'event_location', nullable: true, length: 150 })
  eventLocation: string | null;

  @Column('nvarchar', { name: 'description', nullable: true, length: 500 })
  description: string | null;

  @Column('nvarchar', {
    name: 'evidence_urls',
    nullable: true,
    length: 'MAX',
    default: '[]',
  })
  evidenceUrls: string | null;

  // Nuevos campos para amonestaciones
  @Column('nvarchar', { name: 'penalty_type', nullable: true, length: 50 })
  penaltyType: string | null;

  @Column('datetime', { name: 'penalty_start_date', nullable: true })
  penaltyStartDate: Date | null;

  @Column('datetime', { name: 'penalty_end_date', nullable: true })
  penaltyEndDate: Date | null;

  @Column('int', { name: 'status_blacklist', default: 0 })
  statusBlacklist: number;

  // Relaciones
  @ManyToOne(() => Drivers, (drivers) => drivers.blacklistDrivers)
  @JoinColumn([{ name: 'driver_id', referencedColumnName: 'id' }])
  driver: Drivers;

  // Nueva relación con Shipments
  @ManyToOne(() => Shipments, (shipments) => shipments.blacklistDrivers, {
    onDelete: 'SET NULL', // Si se elimina el shipment, se mantiene el registro de blacklist
    nullable: true,
  })
  @JoinColumn([{ name: 'shipment_id', referencedColumnName: 'id' }])
  shipment: Shipments | null;
}
