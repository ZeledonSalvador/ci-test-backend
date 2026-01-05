import { Test, TestingModule } from '@nestjs/testing';
import { MillsController } from './mills.controller';

describe('MillsController', () => {
  let controller: MillsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MillsController],
    }).compile();

    controller = module.get<MillsController>(MillsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
