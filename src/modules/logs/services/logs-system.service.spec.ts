import { Test, TestingModule } from '@nestjs/testing';
import { LogsSystemService } from './logs-system.service';

describe('LogsSystemService', () => {
  let service: LogsSystemService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LogsSystemService],
    }).compile();

    service = module.get<LogsSystemService>(LogsSystemService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
