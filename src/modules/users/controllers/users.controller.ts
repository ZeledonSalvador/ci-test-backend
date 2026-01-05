import {
    Controller,
    Post,
    Body,
    UseGuards,
    Get,
  } from '@nestjs/common';
  import { UsersService } from '../services/users.service'; // Ajusta la ruta de tu servicio
  import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
  import { Roles } from 'src/modules/auth/decorators/roles.decorator';
  import { Role } from 'src/modules/auth/enums/roles.enum';
import { LoginSimpleDto } from 'src/dto/loginSimple.dto';
import { RegisterSimpleDto } from 'src/dto/registerSimple.dto';
  
  @Controller('users')
  export class UsersController {
    constructor(private readonly usersService: UsersService) {}
  
    // Login de usuario
    @Post('login')
    async login(@Body() loginDto: LoginSimpleDto) {
      return await this.usersService.login(loginDto);
    }
  
    // Registrar un nuevo usuario, solo disponible para ADMIN
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    @Post('register')
    async register(@Body() registerDto: RegisterSimpleDto) {
      return await this.usersService.register(registerDto);
    }
  
    // Obtener todos los usuarios, solo disponible para ADMIN
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    @Get()
    async findAll() {
      return await this.usersService.findAll(Role.ADMIN);
    }
  }
  