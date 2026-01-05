import { Test, TestingModule } from '@nestjs/testing';
import { LogsShipmentsService } from './logs-shipments.service';

describe('LogsShipmentsService', () => {
  let service: LogsShipmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LogsShipmentsService],
    }).compile();

    service = module.get<LogsShipmentsService>(LogsShipmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
