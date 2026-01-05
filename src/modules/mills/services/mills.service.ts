import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterMillDto } from '../dtos/registermill.dto';
import { UpdateMillDto } from '../dtos/updatemill.dto';
import { Users } from 'src/models/Users';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { UsersService } from 'src/modules/users/services/users.service';
import { LoginSimpleDto } from 'src/dto/loginSimple.dto';
import { Clients } from 'src/models/Clients';

@Injectable()
export class MillsService {
    constructor(
        @InjectRepository(Clients)
        private readonly clientsRepository: Repository<Clients>,
        @InjectRepository(Users)
        private readonly usersRepository: Repository<Users>,
        private readonly authService: AuthService,
        private readonly userService: UsersService
    ) { }

    async create(registerMillDto: RegisterMillDto): Promise<Clients> {
        const existingClient = await this.clientsRepository.findOne({
            where: { ingenioCode: registerMillDto.ingenioCode }
        });
        if (existingClient) {
            throw new ConflictException('El cliente ya existe.');
        }
        const user: Users = await this.authService.register({
            username: registerMillDto.username,
            password: registerMillDto.password,
            role: Role.CLIENT
        });
        const savedUser = await this.usersRepository.save(user);
        const client = this.clientsRepository.create({
            ...registerMillDto,
            user: savedUser,
        });
        return this.clientsRepository.save(client);
    }

    async login(loginDto: LoginSimpleDto) {
        return this.authService.login({
            ...loginDto,
            rol: Role.CLIENT
        });
    }



    /* 
        La relacion de clientes y usuarios
        asi que en realidad aca tambien estuviera devolviendo
        un client
    */
    async findAll(): Promise<Users[]> {
        return this.userService.findAll(Role.CLIENT);
    }

    async findOneByUsername(username: string): Promise<Users> {

        const userClient: Users = await this.userService.findOneByUsername(
            username, Role.CLIENT
        );

        if (!userClient) {
            throw new NotFoundException(`Mill called ${userClient} not found`);
        }

        return userClient
    }

    async update(username: string, updateClientDto: UpdateMillDto): Promise<Clients> {
        const client: Users = await this.userService.findOneByUsername(username, Role.CLIENT);
        Object.assign(client, updateClientDto);
        return this.clientsRepository.save(client);
    }

    async remove(username: string): Promise<void> {
        const client = await this.userService.findOneByUsername(username, Role.CLIENT);
        await this.clientsRepository.delete(client.id);
    }
}
