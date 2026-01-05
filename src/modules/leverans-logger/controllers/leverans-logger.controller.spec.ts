import { Test, TestingModule } from '@nestjs/testing';
import { LeveransLoggerController } from './leverans-logger.controller';

describe('LeveransLoggerController', () => {
  let controller: LeveransLoggerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeveransLoggerController],
    }).compile();

    controller = module.get<LeveransLoggerController>(LeveransLoggerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
