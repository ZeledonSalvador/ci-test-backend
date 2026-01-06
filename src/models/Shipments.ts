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
import { Queue } from './Queue';
import { ShipmentAttachments } from './ShipmentAttachments';
import { ShipmentLogs } from './ShipmentLogs';
import { Drivers } from './Drivers';
import { Vehicles } from './Vehicles';
import { Clients } from './Clients';
import { ShipmentSeals } from './ShipmentSeals';
import { Status } from './Status';
import { DataInconsistency } from './DataInconsistency';
import { ShipmentTemperature } from './ShipmentTemperature';
import { BlacklistDrivers } from './BlacklistDrivers';
import { Brix } from './Brix';

const decimalToNumber = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value == null ? null : Number(value)),
};

@Index('PK__Shipment__3213E83F26C1CCBA', ['id'], { unique: true })
@Index('UQ__Shipment__54A76BA8BCD68BDE', ['codeGen'], { unique: true })
@Entity('Shipments', { schema: 'dbo' })
export class Shipments {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('nvarchar', { name: 'code_gen', unique: true, length: 50 })
  codeGen: string;

  @Column('nvarchar', { name: 'product', length: 100 })
  product: string;

  @Column('nvarchar', { name: 'operation_type', length: 10 })
  operationType: string;

  @Column('nvarchar', { name: 'load_type', length: 20 })
  loadType: string;

  @Column('nvarchar', { name: 'transporter', length: 100 })
  transporter: string;

  @Column('decimal', { name: 'product_quantity', precision: 10, scale: 2 })
  productQuantity: number;

  @Column('decimal', { name: 'product_quantity_kg', precision: 10, scale: 2 })
  productQuantityKg: number;

  @Column('nvarchar', { name: 'unit_measure', length: 20 })
  unitMeasure: string;

  @Column('char', { name: 'requiresSweeping', length: 1, default: () => "'N'" })
  requiresSweeping?: string;

  @Column('nvarchar', { name: 'activity_number', length: 5 })
  activityNumber: string;

  @Column('int', {
    name: 'magnetic_card',
    nullable: true,
    default: () => 'NULL',
  })
  magneticCard: number | null;

  @Column('int', {
    name: 'current_status',
    nullable: true,
    default: () => '(1)',
  })
  currentStatus: number | null;

  @Column('datetime', {
    name: 'date_time_current_status',
    nullable: true,
    default: () => 'getdate()',
  })
  dateTimeCurrentStatus: Date | null;

  @Column('datetime', {
    name: 'date_time_precheckeo',
    nullable: true,
    default: () => 'NULL',
  })
  dateTimePrecheckeo: Date | null;

  @Column('int', {
    name: 'id_nav_record',
    nullable: true,
    default: () => 'NULL',
  })
  idNavRecord: number | null;

  @Column('int', {
    name: 'id_pre_transaccion_leverans',
    nullable: true,
    default: () => 'NULL',
  })
  idPreTransaccionLeverans: number | null;

  @Column('bit', { name: 'mapping', default: () => '(0)' })
  mapping: boolean;

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

  @Column('decimal', {
    name: 'peso_bruto',
    precision: 18,
    scale: 3,
    nullable: false,
    default: () => '(0)',
    transformer: decimalToNumber,
  })
  pesoBruto: number;

  @Column('decimal', {
    name: 'peso_tara',
    precision: 18,
    scale: 3,
    nullable: false,
    default: () => '(0)',
    transformer: decimalToNumber,
  })
  pesoTara: number;

  @Column({ name: 'id_excalibur', nullable: true })
  idExcalibur?: string;

  @OneToMany(() => LeveransLogger, (leveransLogger) => leveransLogger.shipment)
  leveransLoggers: LeveransLogger[];

  @OneToMany(() => Queue, (queue) => queue.shipmentCodeGen)
  queues: Queue[];

  @OneToMany(
    () => ShipmentAttachments,
    (shipmentAttachments) => shipmentAttachments.shipment,
  )
  shipmentAttachments: ShipmentAttachments[];

  @OneToMany(() => ShipmentLogs, (shipmentLogs) => shipmentLogs.shipment)
  shipmentLogs: ShipmentLogs[];

  @ManyToOne(() => Drivers, (drivers) => drivers.shipments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'driver_id', referencedColumnName: 'id' }])
  driver: Drivers;

  @ManyToOne(() => Vehicles, (vehicles) => vehicles.shipments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'vehicle_id', referencedColumnName: 'id' }])
  vehicle: Vehicles;

  @ManyToOne(() => Clients, (clients) => clients.shipments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'ingenio_id', referencedColumnName: 'ingenioCode' }])
  ingenio: Clients;

  @OneToMany(() => ShipmentSeals, (shipmentSeals) => shipmentSeals.shipment)
  shipmentSeals: ShipmentSeals[];

  @OneToMany(() => Status, (status) => status.shipment)
  statuses: Status[];

  @Column({ type: 'int', nullable: true })
  buzzer: number;

  @OneToMany(
    () => DataInconsistency,
    (dataInconsistency) => dataInconsistency.shipment,
  )
  dataInconsistencies: DataInconsistency[];

  @OneToMany(() => ShipmentTemperature, (temp) => temp.shipment)
  shipmentTemperatures: ShipmentTemperature[];

  @OneToMany(
    () => BlacklistDrivers,
    (blacklistDrivers) => blacklistDrivers.shipment,
  )
  blacklistDrivers: BlacklistDrivers[];

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    name: 'brix',
  })
  brix?: number | null;

  @OneToMany(() => Brix, (b) => b.shipment)
  brixLogs: Brix[];

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    name: 'humidity',
  })
  humidity?: number | null;

  @Column({
    type: 'nvarchar',
    length: 50,
    nullable: true,
    name: 'code_location',
  })
  locationCode?: string | null;
}
