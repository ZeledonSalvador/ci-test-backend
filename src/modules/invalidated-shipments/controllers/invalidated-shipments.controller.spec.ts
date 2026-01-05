import { Test, TestingModule } from '@nestjs/testing';
import { InvalidatedShipmentsController } from './invalidated-shipments.controller';

describe('InvalidatedShipmentsController', () => {
  let controller: InvalidatedShipmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvalidatedShipmentsController],
    }).compile();

    controller = module.get<InvalidatedShipmentsController>(InvalidatedShipmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
