import { Test, TestingModule } from '@nestjs/testing';
import { LogsShipmentsController } from './logs-shipments.controller';

describe('LogsShipmentsController', () => {
  let controller: LogsShipmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LogsShipmentsController],
    }).compile();

    controller = module.get<LogsShipmentsController>(LogsShipmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
