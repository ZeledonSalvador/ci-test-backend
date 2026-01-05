import {
    Entity,
    Column,
    PrimaryColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('SystemConfig')
export class SystemConfig {
    @PrimaryColumn({ type: 'varchar', length: 50 })
    config_key: string;

    @Column({ type: 'varchar', length: 255 })
    config_value: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    description: string;

    @CreateDateColumn({ type: 'datetime' })
    created_at: Date;

    @UpdateDateColumn({ type: 'datetime' })
    updated_at: Date;
}
