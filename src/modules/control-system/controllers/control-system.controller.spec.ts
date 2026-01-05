import { Test, TestingModule } from '@nestjs/testing';
import { ControlSystemController } from './control-system.controller';

describe('ControlSystemController', () => {
  let controller: ControlSystemController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ControlSystemController],
    }).compile();

    controller = module.get<ControlSystemController>(ControlSystemController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
