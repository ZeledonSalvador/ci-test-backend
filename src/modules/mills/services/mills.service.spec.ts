import { Test, TestingModule } from '@nestjs/testing';
import { MillsService } from './mills.service';

describe('MillsService', () => {
  let service: MillsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MillsService],
    }).compile();

    service = module.get<MillsService>(MillsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
