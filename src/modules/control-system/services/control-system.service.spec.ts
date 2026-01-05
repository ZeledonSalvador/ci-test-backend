import { Test, TestingModule } from '@nestjs/testing';
import { ControlSystemService } from './control-system.service';

describe('ControlSystemService', () => {
  let service: ControlSystemService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ControlSystemService],
    }).compile();

    service = module.get<ControlSystemService>(ControlSystemService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
