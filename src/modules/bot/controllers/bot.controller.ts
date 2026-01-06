import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { BotService } from '../services/bot.service';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { LoginSimpleDto } from 'src/dto/loginSimple.dto';
import { RegisterSimpleDto } from 'src/dto/registerSimple.dto';
import { resLogin } from 'src/modules/auth/dtos/responseLogin.dto';

@Controller('bot')
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Post('login')
  async login(@Body() loginDto: LoginSimpleDto): Promise<resLogin> {
    return await this.botService.login(loginDto);
  }

  @UseGuards(AuthGuard)
  @Roles(Role.ADMIN)
  @Post('register')
  async register(@Body() registerDto: RegisterSimpleDto) {
    return await this.botService.register(registerDto);
  }

  @UseGuards(AuthGuard)
  @Roles(Role.ADMIN)
  @Get()
  async getAll() {
    return await this.botService.findAll();
  }
}
