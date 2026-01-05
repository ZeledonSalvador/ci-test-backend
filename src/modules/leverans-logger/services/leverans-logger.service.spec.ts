import { Test, TestingModule } from '@nestjs/testing';
import { LeveransLoggerService } from './leverans-logger.service';

describe('LeveransLoggerService', () => {
  let service: LeveransLoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LeveransLoggerService],
    }).compile();

    service = module.get<LeveransLoggerService>(LeveransLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
