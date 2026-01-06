import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InternalAuthService } from './internal-auth.service';
import { InternalUsers } from 'src/models/InternalUsers';
import { Permissions } from 'src/models/Permissions';
import { Roles } from 'src/models/Roles';
import { Menu } from 'src/models/Menu';
import { InternalLoginDto } from '../dtos/internal-login.dto';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('InternalAuthService', () => {
  let service: InternalAuthService;
  let internalUsersRepository: Repository<InternalUsers>;
  let permissionsRepository: Repository<Permissions>;
  let rolesRepository: Repository<Roles>;
  let jwtService: JwtService;

  const mockInternalUsersRepository = {
    findOne: jest.fn(),
  };

  const mockPermissionsRepository = {
    find: jest.fn(),
  };

  const mockRolesRepository = {
    findOne: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  // Helper function to create mock InternalUsers
  const createMockUser = (
    overrides: Partial<InternalUsers> = {},
  ): InternalUsers =>
    ({
      id: 1,
      username: 'testuser',
      name: 'Test User',
      password: Buffer.from('hashedpassword'),
      active: 1,
      idRol: 1,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      role: {
        id: 1,
        description: 'Administrador',
        createdAt: new Date('2024-01-01'),
        internalUsers: [],
      },
      permissions: [],
      ...overrides,
    }) as InternalUsers;

  // Helper function to create mock Roles
  const createMockRole = (overrides: Partial<Roles> = {}): Roles =>
    ({
      id: 1,
      description: 'Administrador',
      createdAt: new Date('2024-01-01'),
      internalUsers: [],
      ...overrides,
    }) as Roles;

  // Helper function to create mock Permissions
  const createMockPermission = (
    overrides: Partial<Permissions> = {},
  ): Permissions =>
    ({
      id: 1,
      idUser: 1,
      idMenu: 1,
      createdAt: new Date('2024-01-01'),
      user: createMockUser(),
      menu: {
        id: 1,
        url: 'AutorizacionCamiones',
        icon: '<i class="fa fa-truck"></i>',
        description: 'Chequeo de Información',
        createdAt: new Date('2024-01-01'),
        permissions: [],
      } as Menu,
      ...overrides,
    }) as Permissions;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalAuthService,
        {
          provide: getRepositoryToken(InternalUsers),
          useValue: mockInternalUsersRepository,
        },
        {
          provide: getRepositoryToken(Permissions),
          useValue: mockPermissionsRepository,
        },
        {
          provide: getRepositoryToken(Roles),
          useValue: mockRolesRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<InternalAuthService>(InternalAuthService);
    internalUsersRepository = module.get<Repository<InternalUsers>>(
      getRepositoryToken(InternalUsers),
    );
    permissionsRepository = module.get<Repository<Permissions>>(
      getRepositoryToken(Permissions),
    );
    rolesRepository = module.get<Repository<Roles>>(getRepositoryToken(Roles));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateInternalUser', () => {
    it('should return user for valid credentials', async () => {
      const mockUser = createMockUser({
        username: 'testuser',
        password: Buffer.from('hashedpassword'),
      });

      mockInternalUsersRepository.findOne.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await service.validateInternalUser(
        'testuser',
        'password123',
      );

      expect(internalUsersRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser', active: 1 },
        relations: ['role'],
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashedpassword',
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null for invalid password', async () => {
      const mockUser = createMockUser();

      mockInternalUsersRepository.findOne.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false);

      const result = await service.validateInternalUser(
        'testuser',
        'wrongpassword',
      );

      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      mockInternalUsersRepository.findOne.mockResolvedValue(null);

      const result = await service.validateInternalUser(
        'nonexistent',
        'password123',
      );

      expect(result).toBeNull();
    });
  });

  describe('getUserPermissions', () => {
    it('should return array of permission URLs', async () => {
      const mockPermissions = [
        createMockPermission({
          idUser: 1,
          idMenu: 1,
          menu: {
            id: 1,
            url: 'AutorizacionCamiones',
            icon: '<i class="fa fa-truck"></i>',
            description: 'Chequeo de Información',
            createdAt: new Date('2024-01-01'),
            permissions: [],
          } as Menu,
        }),
        createMockPermission({
          id: 2,
          idUser: 1,
          idMenu: 2,
          menu: {
            id: 2,
            url: 'TiemposAzucar',
            icon: '<i class="fas fa-cubes"></i>',
            description: 'Recepción de Azúcar',
            createdAt: new Date('2024-01-01'),
            permissions: [],
          } as Menu,
        }),
      ];

      mockPermissionsRepository.find.mockResolvedValue(mockPermissions);

      const result = await service.getUserPermissions(1);

      expect(permissionsRepository.find).toHaveBeenCalledWith({
        where: { idUser: 1 },
        relations: ['menu'],
      });
      expect(result).toEqual(['AutorizacionCamiones', 'TiemposAzucar']);
    });

    it('should return empty array when user has no permissions', async () => {
      mockPermissionsRepository.find.mockResolvedValue([]);

      const result = await service.getUserPermissions(1);

      expect(result).toEqual([]);
    });
  });

  describe('getRoleInfo', () => {
    it('should return role information', async () => {
      const mockRole = createMockRole({
        id: 1,
        description: 'Administrador',
      });

      mockRolesRepository.findOne.mockResolvedValue(mockRole);

      const result = await service.getRoleInfo(1);

      expect(rolesRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual({ id: 1, description: 'Administrador' });
    });

    it('should return null for non-existent role', async () => {
      mockRolesRepository.findOne.mockResolvedValue(null);

      const result = await service.getRoleInfo(999);

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return login response for valid credentials', async () => {
      const loginDto: InternalLoginDto = {
        username: 'testuser',
        password: 'password123',
        bascula: '1',
        turno: 'MAÑANA',
      };

      const mockUser = createMockUser({
        username: 'testuser',
        name: 'Test User',
        idRol: 1,
      });

      const mockRole = createMockRole({
        id: 1,
        description: 'Administrador',
      });

      const mockPermissions = ['AutorizacionCamiones', 'TiemposAzucar'];
      const mockToken = 'jwt-token-here';

      // Setup mocks
      jest.spyOn(service, 'validateInternalUser').mockResolvedValue(mockUser);
      jest.spyOn(service, 'getRoleInfo').mockResolvedValue(mockRole);
      jest
        .spyOn(service, 'getUserPermissions')
        .mockResolvedValue(mockPermissions);
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await service.login(loginDto);

      expect(service.validateInternalUser).toHaveBeenCalledWith(
        'testuser',
        'password123',
      );
      expect(service.getRoleInfo).toHaveBeenCalledWith(1);
      expect(service.getUserPermissions).toHaveBeenCalledWith(1);
      expect(jwtService.sign).toHaveBeenCalled();

      expect(result.access_token).toBe(mockToken);
      expect(result.codUsuario).toBe(1);
      expect(result.username).toBe('testuser');
      expect(result.nombreRol).toBe('Administrador');
      expect(result.permisos).toEqual(mockPermissions);
      expect(result.esValido).toBe(true);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const loginDto: InternalLoginDto = {
        username: 'wronguser',
        password: 'wrongpass',
      };

      jest.spyOn(service, 'validateInternalUser').mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(service.validateInternalUser).toHaveBeenCalledWith(
        'wronguser',
        'wrongpass',
      );
    });

    it('should throw NotFoundException for non-existent role', async () => {
      const loginDto: InternalLoginDto = {
        username: 'testuser',
        password: 'password123',
      };

      const mockUser = createMockUser({
        idRol: 999,
      });

      jest.spyOn(service, 'validateInternalUser').mockResolvedValue(mockUser);
      jest.spyOn(service, 'getRoleInfo').mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyInternalJwt', () => {
    it('should return valid result for valid token', async () => {
      const token = 'valid-jwt-token';
      const mockPayload = {
        sub: 1,
        username: 'testuser',
        codRol: 1,
        name: 'Test User',
        nombreRol: 'Administrador',
        permisos: ['AutorizacionCamiones'],
      };

      const mockUser = createMockUser({
        id: 1,
        username: 'testuser',
        active: 1,
      });

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockInternalUsersRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.verifyInternalJwt(token);

      expect(jwtService.verify).toHaveBeenCalledWith(token);
      expect(internalUsersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, active: 1 },
      });
      expect(result).toEqual({
        valid: true,
        payload: mockPayload,
        message: 'Token válido',
      });
    });

    it('should return invalid result for inactive user', async () => {
      const token = 'valid-jwt-token';
      const mockPayload = {
        sub: 1,
        username: 'testuser',
        codRol: 1,
        name: 'Test User',
        nombreRol: 'Administrador',
        permisos: ['AutorizacionCamiones'],
      };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockInternalUsersRepository.findOne.mockResolvedValue(null);

      const result = await service.verifyInternalJwt(token);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Usuario inactivo');
    });

    it('should return invalid result for invalid token', async () => {
      const token = 'invalid-jwt-token';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Token inválido');
      });

      const result = await service.verifyInternalJwt(token);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Token inválido');
    });
  });

  describe('getUserRedirectUrl', () => {
    it('should return correct redirect URL for Administrador', async () => {
      const mockRole = createMockRole({
        id: 1,
        description: 'Administrador',
      });

      jest.spyOn(service, 'getRoleInfo').mockResolvedValue(mockRole);

      const result = await service.getUserRedirectUrl(1);

      expect(result).toBe('AutorizacionCamiones');
    });

    it('should return correct redirect URL for Operador', async () => {
      const mockRole = createMockRole({
        id: 4,
        description: 'Operador',
      });

      jest.spyOn(service, 'getRoleInfo').mockResolvedValue(mockRole);

      const result = await service.getUserRedirectUrl(4);

      expect(result).toBe('TiemposAzucar');
    });

    it('should return default URL for unknown role', async () => {
      const mockRole = createMockRole({
        id: 999,
        description: 'UnknownRole',
      });

      jest.spyOn(service, 'getRoleInfo').mockResolvedValue(mockRole);

      const result = await service.getUserRedirectUrl(999);

      expect(result).toBe('AutorizacionCamiones');
    });

    it('should return default URL when role not found', async () => {
      jest.spyOn(service, 'getRoleInfo').mockResolvedValue(null);

      const result = await service.getUserRedirectUrl(999);

      expect(result).toBe('AutorizacionCamiones');
    });
  });
});
