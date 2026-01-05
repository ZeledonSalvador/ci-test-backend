import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { UsersService } from 'src/modules/users/services/users.service';
import { Users } from 'src/models/Users';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { LoginSimpleDto } from 'src/dto/loginSimple.dto';
import { RegisterSimpleDto } from 'src/dto/registerSimple.dto';
import { resLogin } from 'src/modules/auth/dtos/responseLogin.dto';

@Injectable()
export class BotService {
    constructor(
        private readonly usersService: UsersService,
        private readonly authService: AuthService,
    ) {}

    async login(loginDto: LoginSimpleDto) : Promise<resLogin> {
        return this.authService.login({
            ...loginDto,
            rol: Role.BOT
        });
    }

    async register(registerDto: RegisterSimpleDto) : Promise<Users> {
        return this.authService.register({
            ...registerDto,
            role: Role.BOT
        });
    }

    async findAll(): Promise<Users[]> {
        return this.usersService.findAll(Role.BOT);
    }

    async findOne(id: string): Promise<Users> {
        const user = await this.usersService.findOne(id);
        if (!user) {
            throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
        }
        return user;
    }

}
