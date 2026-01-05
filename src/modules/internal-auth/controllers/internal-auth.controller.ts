import { Controller, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { InternalAuthService } from '../services/internal-auth.service';
import { InternalLoginDto } from '../dtos/internal-login.dto';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';

@Controller('internal-auth')
export class InternalAuthController {
  constructor(private readonly authService: InternalAuthService) {}

  @Post('login')
  async login(@Body() loginDto: InternalLoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @UseGuards(AuthGuard)
  @Roles(Role.ADMIN)
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.createUser(createUserDto);
  }

  @Put('users/:id')
  @UseGuards(AuthGuard)
  @Roles(Role.ADMIN)
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.authService.updateUser(parseInt(id), updateUserDto);
  }

  @Post('verify-token')
  async verifyToken(@Body('token') token: string) {
    return this.authService.validateToken(token);
  }
}