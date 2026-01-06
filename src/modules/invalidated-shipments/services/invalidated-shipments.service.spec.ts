import { Test, TestingModule } from '@nestjs/testing';
import { InvalidatedShipmentsService } from './invalidated-shipments.service';

describe('InvalidatedShipmentsService', () => {
  let service: InvalidatedShipmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvalidatedShipmentsService],
    }).compile();

    service = module.get<InvalidatedShipmentsService>(
      InvalidatedShipmentsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
