import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { InternalAuthController } from './internal-auth.controller';
import { InternalAuthService } from '../services/internal-auth.service';
import { InternalAuthGuard } from '../guards/internal-auth.guard';
import { InternalLoginDto } from '../dtos/internal-login.dto';
import { InternalLoginResponseDto } from '../dtos/internal-login-response.dto';

describe('InternalAuthController', () => {
  let controller: InternalAuthController;
  let service: InternalAuthService;

  const mockInternalAuthService = {
    login: jest.fn(),
    verifyInternalJwt: jest.fn(),
    getUserRedirectUrl: jest.fn(),
  };

  const mockJwtService = {
    verify: jest.fn(),
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalAuthController],
      providers: [
        {
          provide: InternalAuthService,
          useValue: mockInternalAuthService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        InternalAuthGuard,
      ],
    }).compile();

    controller = module.get<InternalAuthController>(InternalAuthController);
    service = module.get<InternalAuthService>(InternalAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should return access token and user info on successful login', async () => {
      const loginDto: InternalLoginDto = {
        username: 'testuser',
        password: 'testpass',
        bascula: '1',
        turno: 'MAÑANA',
      };

      const expectedResponse: InternalLoginResponseDto = {
        access_token: 'jwt-token-here',
        codUsuario: 1,
        codRol: 1,
        username: 'testuser',
        name: 'Test User',
        nombreRol: 'Administrador',
        codBascula: '1',
        codTurno: '1',
        permisos: ['AutorizacionCamiones', 'TiemposAzucar'],
        redirectUrl: 'AutorizacionCamiones',
        fechaCreacion: new Date(),
        fechaExpiracion: new Date(),
        duracionHoras: 8,
        esValido: true,
      };

      mockInternalAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(loginDto);

      expect(service.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(expectedResponse);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const loginDto: InternalLoginDto = {
        username: 'wronguser',
        password: 'wrongpass',
      };

      mockInternalAuthService.login.mockRejectedValue(new Error('Credenciales inválidas'));

      await expect(controller.login(loginDto)).rejects.toThrow('Credenciales inválidas');
      expect(service.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('verifyToken', () => {
    it('should return token validation result', async () => {
      const token = 'valid-jwt-token';
      const expectedResult = {
        valid: true,
        payload: {
          sub: 1,
          username: 'testuser',
          codRol: 1,
        },
        message: 'Token válido',
      };

      mockInternalAuthService.verifyInternalJwt.mockResolvedValue(expectedResult);

      const result = await controller.verifyToken(token);

      expect(service.verifyInternalJwt).toHaveBeenCalledWith(token);
      expect(result).toEqual(expectedResult);
    });

    it('should return invalid result for expired token', async () => {
      const token = 'expired-jwt-token';
      const expectedResult = {
        valid: false,
        payload: null,
        message: 'Token expirado',
      };

      mockInternalAuthService.verifyInternalJwt.mockResolvedValue(expectedResult);

      const result = await controller.verifyToken(token);

      expect(service.verifyInternalJwt).toHaveBeenCalledWith(token);
      expect(result).toEqual(expectedResult);
    });
  });
});