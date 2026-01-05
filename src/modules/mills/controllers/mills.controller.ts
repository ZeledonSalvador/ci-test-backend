import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { MillsService } from '../services/mills.service';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { RegisterMillDto } from '../dtos/registermill.dto';
import { UpdateMillDto } from '../dtos/updatemill.dto';
import { LoginSimpleDto } from 'src/dto/loginSimple.dto';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { Users } from 'src/models/Users';


@Controller({ path: "mills", version: "1" })
export class MillsController {
    constructor(private readonly millsService: MillsService) { }

    // Registrar un nuevo mill (solo admin)
    @Post('register')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    async register(@Body() registerDto: RegisterMillDto) {
        console.log('Esto es lo que viene del request desde controller: ', registerDto);
        return this.millsService.create(registerDto);
    }

    @Post('login')
    async login(@Body() loginDto: LoginSimpleDto) {
        return await this.millsService.login(loginDto);
    }

    // Obtener todos los mills (solo admin)
    @Get()
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    async findAll() {
        return this.millsService.findAll();
    }

    // Obtener un mill por id (admin y el propio mill)
    @Get(':username')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    async findOne(@Param('username') username: string) : Promise<Users> {
        return this.millsService.findOneByUsername(username);
    }

    // Actualizar un mill (solo admin y el mismo mill)
    @Put(':username')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    async update(@Param('username') username: string, @Body() updateMillDto: UpdateMillDto) {
        return this.millsService.update(username, updateMillDto);
    }

    // Eliminar un mill (solo admin)
    @Delete(':id')
    @UseGuards(AuthGuard)
    @Roles(Role.ADMIN)
    async remove(@Param('username') username: string) {
        return this.millsService.remove(username);
    }
}
