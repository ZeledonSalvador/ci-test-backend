import {
    Controller,
    Post,
    Body,
    UseGuards
  } from '@nestjs/common';
  import { Roles } from 'src/modules/auth/decorators/roles.decorator';
  import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
  import { LeveransLoggerService } from '../services/leverans-logger.service';
  import { Role } from 'src/modules/auth/enums/roles.enum';
import { LeveransLoginDto } from '../dto/LeveransLogin.dto';

  
  @Controller('leverans-logger')
  @UseGuards(AuthGuard)
  export class LeveransLoggerController {
    constructor(private readonly leveransLoggerService: LeveransLoggerService) {}
  
    @Roles(Role.ADMIN, Role.BOT)
    @Post('login')
    async login(@Body() loginDto: LeveransLoginDto) {
      const { username, bascula, shift } = loginDto;
      return this.leveransLoggerService.login(username, bascula, shift);
    }
  }
  