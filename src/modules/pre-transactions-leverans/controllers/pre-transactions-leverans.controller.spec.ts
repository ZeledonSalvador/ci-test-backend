import { Test, TestingModule } from '@nestjs/testing';
import { PreTransactionsLeveransController } from './pre-transactions-leverans.controller';

describe('PreTransactionsLeveransController', () => {
  let controller: PreTransactionsLeveransController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreTransactionsLeveransController],
    }).compile();

    controller = module.get<PreTransactionsLeveransController>(PreTransactionsLeveransController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
