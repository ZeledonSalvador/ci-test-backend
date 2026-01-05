import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dtos/LoginDto';
import { Roles } from '../decorators/roles.decorator';
import { RegisterDto } from 'src/modules/users/dto/registerRequest.dto';
import { AuthGuard } from '../guards/auth.guard';
import { resLogin } from '../dtos/responseLogin.dto';
import { Role } from '../enums/roles.enum';
import { Users } from 'src/models/Users';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    async login(@Body() loginDto: LoginDto): Promise<resLogin> {
        return this.authService.login(loginDto);
    }

    @Post('register')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    async register(@Body() registerDto: RegisterDto): Promise<Users> {
        return this.authService.register(registerDto);
    }

    @Post('verify-jwt')
    async verifyJwt(@Body('access_token') token: string): Promise<any> {
        const isValid = await this.authService.verifyJwt(token);
        return isValid;
    }
}
