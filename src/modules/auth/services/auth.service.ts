import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    Inject, forwardRef
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/modules/users/services/users.service';
import { LoginDto } from '../dtos/LoginDto';
import { JwtPayloadDto } from '../dtos/jwtpayload.dto';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from 'src/modules/users/dto/registerRequest.dto';
import { Users } from 'src/models/Users';
import { Role } from '../enums/roles.enum';
import { resLogin } from '../dtos/responseLogin.dto';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
    constructor(
        @Inject(forwardRef(() => UsersService))
        private usersService: UsersService,
        private jwtService: JwtService,
    ) { }

    async validateUser(username: string, password: string, role: string): Promise<Users | null> {
        const user = await this.usersService.findOneWithWhere({
            username: username,
            role: role,
        });

        if (user && await bcrypt.compare(password, user.password)) {
            return user;
        }
        return null;
    }


    async login(user: LoginDto): Promise<resLogin> {
        const validatedUser = await this.validateUser(user.username, user.password, user.rol);
        if (!validatedUser) {
            throw new UnauthorizedException();
        }

        // 🔧 Mapeo explícito de roles al enum Role
        const roleMap: Record<string, Role> = {
            admin: Role.ADMIN,
            cliente: Role.CLIENT,
            bot: Role.BOT,
        };

        const rawRole = validatedUser.role?.toLowerCase();
        const normalizedRole = roleMap[rawRole];

        if (!normalizedRole) {
            throw new UnauthorizedException(`Rol inválido: ${validatedUser.role}`);
        }

        const payload: JwtPayloadDto = {
            username: validatedUser.username,
            sub: validatedUser.id,
            roles: [normalizedRole],
        };

        console.log("✅ Payload JWT a firmar:", payload);

        // ⏳ Control de expiración según tipo de rol
        const token: string = normalizedRole === Role.BOT
            ? this.jwtService.sign(payload, { 
                expiresIn: user.expiration === 'unlimited' ? '25y' : user.expiration || '1d',
            })
            : this.jwtService.sign(payload);

        return {
            access_token: token,
        };
    }

    async register(registerDto: RegisterDto): Promise<Users> {
        const existingUser = await this.usersService.findOne(registerDto.username);
        if (existingUser) {
            throw new ConflictException('El nombre de usuario ya está en uso.');
        }

        const hashedPassword = await bcrypt.hash(registerDto.password, 10);

        const newUser = new Users();
        newUser.username = registerDto.username;
        newUser.password = hashedPassword;
        newUser.role = registerDto.role;
        return this.usersService.create(newUser);
    }


    async verifyJwt(token: string): Promise<any> {
        try {
            // Decodificamos el token para obtener su payload sin verificar aún la firma
            const decoded = jwt.decode(token, { complete: true });

            if (!decoded || !decoded.payload) {
                throw new Error('Token inválido o no decodificable');
            }

            // Verificamos que el payload sea de tipo JwtPayload
            const payload = decoded.payload as jwt.JwtPayload;

            if (!payload.exp) {
                throw new Error('El token no tiene tiempo de expiración');
            }

            const expirationTime = payload.exp; // El tiempo de expiración es un timestamp UNIX

            // Verificamos la validez del token
            const isValid = this.isTokenValid(token);

            // Calculamos el tiempo restante hasta la expiración
            const currentTime = Math.floor(Date.now() / 1000); // Tiempo actual en segundos
            const timeToExpire = expirationTime - currentTime;

            // Si ya ha expirado, devolver 0 para todas las unidades
            if (timeToExpire <= 0) {
                return {
                    valid: false,
                    payload: null,
                    timeToExpire: 0,
                    timeRemainingByUnits: this.formatTime(0),
                    timeRemainingDetailed: this.getDetailedTime(0),
                    formattedTime: "Token ha expirado"
                };
            }

            // Formatear el tiempo restante en diferentes unidades
            const timeRemainingByUnits = this.formatTime(timeToExpire);

            // Desglosar el tiempo en unidades específicas
            const timeRemainingDetailed = this.getDetailedTime(timeToExpire);

            // Determinar el mensaje con las unidades más grandes y pequeñas
            const formattedTime = this.getFormattedTime(timeRemainingByUnits);

            return {
                valid: isValid,
                payload: payload,
                timeToExpire: timeToExpire,
                timeRemainingByUnits: timeRemainingByUnits,
                timeRemainingDetailed: timeRemainingDetailed,
                formattedTime: formattedTime
            };
        } catch (error) {
            return {
                valid: false,
                payload: null,
                timeToExpire: 0,
                timeRemainingByUnits: this.formatTime(0),
                timeRemainingDetailed: this.getDetailedTime(0),
                formattedTime: "Token inválido o no decodificable",
                error: error.message
            };
        }
    }


    private isTokenValid(token: string): boolean {
        try {
            jwt.verify(token, process.env.JWT_SECRET);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Función para convertir los segundos restantes en diferentes unidades
    private formatTime(seconds: number): any {
        const milliseconds = seconds * 1000;
        const years = Math.floor(seconds / (60 * 60 * 24 * 365));
        const months = Math.floor(seconds / (60 * 60 * 24 * 30));
        const weeks = Math.floor(seconds / (60 * 60 * 24 * 7));
        const days = Math.floor(seconds / (60 * 60 * 24));
        const hours = Math.floor((seconds % (60 * 60 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        return {
            milliseconds,
            seconds: remainingSeconds,
            minutes,
            hours,
            days,
            weeks,
            months,
            years
        };
    }

    // Función para desglosar el tiempo en unidades más pequeñas
    private getDetailedTime(seconds: number): any {
        const years = Math.floor(seconds / (60 * 60 * 24 * 365));
        const months = Math.floor((seconds % (60 * 60 * 24 * 365)) / (60 * 60 * 24 * 30));
        const weeks = Math.floor((seconds % (60 * 60 * 24 * 30)) / (60 * 60 * 24 * 7));
        const days = Math.floor((seconds % (60 * 60 * 24 * 7)) / (60 * 60 * 24));
        const hours = Math.floor((seconds % (60 * 60 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        return {
            years,
            months,
            weeks,
            days,
            hours,
            minutes,
            seconds: remainingSeconds
        };
    }

    // Función para obtener el mensaje con el formato más legible y conciso
    private getFormattedTime(timeFormatted: any): string {
        let formatted = 'Faltan';

        if (timeFormatted.years > 0) {
            formatted += ` ${timeFormatted.years} año${timeFormatted.years > 1 ? 's' : ''}`;
        }
        if (timeFormatted.months > 0) {
            formatted += ` ${timeFormatted.months} mes${timeFormatted.months > 1 ? 'es' : ''}`;
        }
        if (timeFormatted.weeks > 0) {
            formatted += ` ${timeFormatted.weeks} semana${timeFormatted.weeks > 1 ? 's' : ''}`;
        }
        if (timeFormatted.days > 0) {
            formatted += ` ${timeFormatted.days} día${timeFormatted.days > 1 ? 's' : ''}`;
        }
        if (timeFormatted.hours > 0) {
            formatted += ` ${timeFormatted.hours} hora${timeFormatted.hours > 1 ? 's' : ''}`;
        }
        if (timeFormatted.minutes > 0) {
            formatted += ` ${timeFormatted.minutes} minuto${timeFormatted.minutes > 1 ? 's' : ''}`;
        }
        if (timeFormatted.seconds > 0) {
            formatted += ` ${timeFormatted.seconds} segundo${timeFormatted.seconds > 1 ? 's' : ''}`;
        }

        return formatted;
    }
}
