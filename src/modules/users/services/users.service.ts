import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LoginSimpleDto } from 'src/dto/loginSimple.dto';
import { RegisterSimpleDto } from 'src/dto/registerSimple.dto';
import { Clients } from 'src/models/Clients';
import { InvalidatedShipments } from 'src/models/InvalidatedShipments';
import { Shipments } from 'src/models/Shipments';
import { Users } from 'src/models/Users';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users)
    private usersRepository: Repository<Users>,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    @InjectRepository(Shipments)
    private shipmentsRepository: Repository<Shipments>,
    @InjectRepository(Clients)
    private clientsRepository: Repository<Clients>,
    @InjectRepository(InvalidatedShipments)
    private invalidatedShipmentsRepository: Repository<InvalidatedShipments>,
  ) {}

  async login(loginDto: LoginSimpleDto) {
    return this.authService.login({
      ...loginDto,
      rol: Role.ADMIN,
    });
  }

  async register(registerDto: RegisterSimpleDto) {
    return this.authService.register({
      ...registerDto,
      role: Role.ADMIN,
    });
  }

  async findOneById(id: number): Promise<Users | undefined> {
    return await this.usersRepository.findOne({ where: { id } });
  }

  async getUserByCodeClient(codeClient: string): Promise<Users> {
    const client = await this.clientsRepository.findOne({
      where: { ingenioCode: codeClient },
      relations: ['user'],
    });

    if (!client) {
      throw new NotFoundException('No se encontro el cliente con ese codigo');
    }

    return client.user;
  }

  async handleGetUser(
    codeGen: string | null,
    codeClient: string | null,
  ): Promise<Users> {
    console.log('Código de generación recibido (codeGen):', codeGen);
    console.log('Código de cliente recibido (codeClient):', codeClient);

    // Validar que al menos uno de los códigos no sea null
    if (!codeGen && !codeClient) {
      console.error('Error: Ambos códigos son nulos');
      throw new BadRequestException(
        'Debe proporcionar al menos un código para buscar el usuario',
      );
    }

    // Priorizar la búsqueda por codeGen si existe
    if (codeGen) {
      const shipmentExists = await this.shipmentsRepository.findOne({
        where: { codeGen },
      });

      if (shipmentExists) {
        console.log('Shipment encontrado con codeGen:', codeGen);
        return this.getUserByShipment(codeGen);
      } else {
        /* 
          Si no se encontro el shipment entonces hay que buscar si esta
          invalidado
        */

        const shipmentInvalid =
          await this.invalidatedShipmentsRepository.findOne({
            where: {
              codeGen: codeGen,
            },
          });

        if (shipmentInvalid) {
          /* 
            Si si hay un registro, bueno, debo mandar un error claro
          */
          throw new ConflictException(
            'El código de generación que ha proporcionado está invalidado. Si considera que se trata de un error, por favor póngase en contacto con el propietario para revalidarlo.',
          );
        }
        console.warn('No se encontró shipment con codeGen:', codeGen);
      }
    }

    // Si no se encontró un usuario con codeGen, intentar con codeClient
    if (codeClient) {
      const clientExists = await this.clientsRepository.findOne({
        where: { ingenioCode: codeClient },
      });

      if (clientExists) {
        console.log('Cliente encontrado con codeClient:', codeClient);
        return this.getUserByCodeClient(codeClient);
      } else {
        console.warn('No se encontró cliente con codeClient:', codeClient);
      }
    } else {
      console.log('CodeClient es nulo, omitiendo búsqueda de cliente.');
    }

    // Si ninguno de los códigos es válido, lanzar una excepción
    console.error(
      'Error: No se encontró un usuario con los códigos proporcionados',
    );
    throw new NotFoundException(
      'No se pudo encontrar un usuario con los códigos proporcionados',
    );
  }

  async getUserByShipment(codeGen: string): Promise<Users> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { codeGen },
      relations: ['ingenio', 'ingenio.user'],
    });

    if (!shipment) {
      throw new Error('El envio no fue encontrado');
    }

    const client = shipment.ingenio;

    if (!client) {
      throw new Error('El cliente no fue encontrado');
    }

    const user = client.user;

    if (!user) {
      throw new Error('No existe un cliente para ese User');
    }

    return user;
  }

  async findOneByUsername(
    username: string,
    role?: string,
  ): Promise<Users | undefined> {
    if (role === Role.CLIENT) {
      return await this.usersRepository.findOne({
        where: { username },
        relations: ['clients'],
      });
    }

    return await this.usersRepository.findOne({
      where: { username },
    });
  }

  async findOne(username: string): Promise<Users | undefined> {
    return await this.usersRepository.findOne({ where: { username } });
  }

  async findOneWithWhere(where: any): Promise<Users | undefined> {
    return await this.usersRepository.findOne({
      where: where,
    });
  }

  async create(user: Users): Promise<Users> {
    return this.usersRepository.save(user);
  }

  async findAll(role?: string): Promise<Users[]> {
    if (role === Role.CLIENT) {
      return await this.usersRepository.find({
        where: { role },
        relations: ['clients'],
      });
    }

    return await this.usersRepository.find({
      where: { role },
    });
  }
}
