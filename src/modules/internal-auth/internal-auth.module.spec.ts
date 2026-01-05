import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InternalAuthModule } from './internal-auth.module';
import { InternalAuthController } from './controllers/internal-auth.controller';
import { InternalAuthService } from './services/internal-auth.service';
import { InternalAuthGuard } from './guards/internal-auth.guard';

describe('InternalAuthModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [__dirname + '/../../../models/*.ts'],
          synchronize: true,
        }),
        InternalAuthModule,
      ],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have InternalAuthController', () => {
    const controller = module.get<InternalAuthController>(InternalAuthController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(InternalAuthController);
  });

  it('should have InternalAuthService', () => {
    const service = module.get<InternalAuthService>(InternalAuthService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(InternalAuthService);
  });

  it('should have InternalAuthGuard', () => {
    const guard = module.get<InternalAuthGuard>(InternalAuthGuard);
    expect(guard).toBeDefined();
    expect(guard).toBeInstanceOf(InternalAuthGuard);
  });

  it('should have JwtService', () => {
    const jwtService = module.get<JwtService>(JwtService);
    expect(jwtService).toBeDefined();
    expect(jwtService).toBeInstanceOf(JwtService);
  });

  it('should export InternalAuthService', () => {
    const exportedService = module.get<InternalAuthService>(InternalAuthService);
    expect(exportedService).toBeDefined();
  });

  it('should export InternalAuthGuard', () => {
    const exportedGuard = module.get<InternalAuthGuard>(InternalAuthGuard);
    expect(exportedGuard).toBeDefined();
  });
});