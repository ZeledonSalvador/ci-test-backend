import { Test, TestingModule } from '@nestjs/testing';
import { PreTransactionsLeveransService } from './pre-transactions-leverans.service';

describe('PreTransactionsLeveransService', () => {
  let service: PreTransactionsLeveransService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PreTransactionsLeveransService],
    }).compile();

    service = module.get<PreTransactionsLeveransService>(PreTransactionsLeveransService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
