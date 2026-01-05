import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfig } from 'src/models/SystemConfig';
import { ConfigService } from './services/config.service';

@Module({
    imports: [TypeOrmModule.forFeature([SystemConfig])],
    providers: [ConfigService],
    exports: [ConfigService],
})
export class ConfigModule {}
