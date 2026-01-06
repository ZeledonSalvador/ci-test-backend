import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { InternalAuthGuard } from './internal-auth.guard';
import { InternalJwtPayloadDto } from '../dtos/internal-jwt-payload.dto';

describe('InternalAuthGuard', () => {
  let guard: InternalAuthGuard;
  let jwtService: JwtService;
  let reflector: Reflector;

  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockReflector = {
    get: jest.fn(),
  };

  // 🆕 Helper para crear mock payload completo
  const createMockPayload = (
    overrides: Partial<InternalJwtPayloadDto> = {},
  ): InternalJwtPayloadDto => ({
    sub: 1,
    username: 'testuser',
    name: 'Test User',
    codRol: 1,
    nombreRol: 'Administrador',
    permisos: ['AutorizacionCamiones', 'TiemposAzucar'],
    fechaCreacion: '20/08/2025 10:00:00',
    fechaExpiracion: '20/08/2025 18:00:00',
    duracionHoras: 8,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalAuthGuard,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<InternalAuthGuard>(InternalAuthGuard);
    jwtService = module.get<JwtService>(JwtService);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    headers: any = {},
    url: string = '/test',
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          url,
        }),
      }),
      getHandler: jest.fn(),
    } as any;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true when no permissions are required', async () => {
      const context = createMockExecutionContext();
      mockReflector.get.mockReturnValue(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.get).toHaveBeenCalledWith(
        'internal-permissions',
        context.getHandler(),
      );
    });

    it('should return true when permissions array is empty', async () => {
      const context = createMockExecutionContext();
      mockReflector.get.mockReturnValue([]);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when authorization header is missing', async () => {
      const context = createMockExecutionContext({}, '/protected-route');
      mockReflector.get.mockReturnValue(['AutorizacionCamiones']);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Falta el encabezado de autorización',
      );
    });

    it('should return true when user has required permissions', async () => {
      const headers = {
        authorization: 'Bearer valid-jwt-token',
      };
      const context = createMockExecutionContext(
        headers,
        '/autorizacion-camiones',
      );

      const mockPayload = createMockPayload({
        sub: 1,
        username: 'testuser',
        name: 'Test User',
        codRol: 1,
        nombreRol: 'Administrador',
        permisos: ['AutorizacionCamiones', 'TiemposAzucar'],
      });

      mockReflector.get.mockReturnValue(['AutorizacionCamiones']);
      mockJwtService.verify.mockReturnValue(mockPayload);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith('valid-jwt-token');
      expect(reflector.get).toHaveBeenCalledWith(
        'internal-permissions',
        context.getHandler(),
      );
    });

    it('should throw ForbiddenException when user lacks required permissions', async () => {
      const headers = {
        authorization: 'Bearer valid-jwt-token',
      };
      const context = createMockExecutionContext(headers, '/admin-panel');

      const mockPayload = createMockPayload({
        sub: 1,
        username: 'testuser',
        name: 'Test User',
        codRol: 5,
        nombreRol: 'Vigilante',
        permisos: ['AutorizacionPorton'],
      });

      mockReflector.get.mockReturnValue(['AdminPanel']);
      mockJwtService.verify.mockReturnValue(mockPayload);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'No tiene permisos para acceder a este recurso',
      );
    });

    it('should return true when user has at least one of the required permissions', async () => {
      const headers = {
        authorization: 'Bearer valid-jwt-token',
      };
      const context = createMockExecutionContext(
        headers,
        '/multi-permission-endpoint',
      );

      const mockPayload = createMockPayload({
        sub: 1,
        username: 'testuser',
        name: 'Test User',
        codRol: 2,
        nombreRol: 'Supervisor',
        permisos: ['AutorizacionCamiones', 'AutorizacionIngreso'],
      });

      mockReflector.get.mockReturnValue(['AdminPanel', 'AutorizacionCamiones']);
      mockJwtService.verify.mockReturnValue(mockPayload);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when JWT token is invalid', async () => {
      const headers = {
        authorization: 'Bearer invalid-jwt-token',
      };
      const context = createMockExecutionContext(headers, '/protected-route');

      mockReflector.get.mockReturnValue(['AutorizacionCamiones']);
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Token inválido');
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Token inválido',
      );
    });

    it('should add user info to request when authorization succeeds', async () => {
      const headers = {
        authorization: 'Bearer valid-jwt-token',
      };

      const mockRequest = {
        headers,
        url: '/autorizacion-camiones',
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: jest.fn(),
      } as any;

      const mockPayload = createMockPayload({
        sub: 1,
        username: 'testuser',
        name: 'Test User',
        codRol: 1,
        nombreRol: 'Administrador',
        permisos: ['AutorizacionCamiones'],
      });

      mockReflector.get.mockReturnValue(['AutorizacionCamiones']);
      mockJwtService.verify.mockReturnValue(mockPayload);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest).toHaveProperty('internalUser', mockPayload);
    });

    it('should handle payload with missing optional fields', async () => {
      const headers = {
        authorization: 'Bearer valid-jwt-token',
      };
      const context = createMockExecutionContext(
        headers,
        '/autorizacion-camiones',
      );

      const mockPayload = createMockPayload({
        codBascula: undefined,
        codTurno: undefined,
        name: null,
      });

      mockReflector.get.mockReturnValue(['AutorizacionCamiones']);
      mockJwtService.verify.mockReturnValue(mockPayload);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle expired token', async () => {
      const headers = {
        authorization: 'Bearer expired-jwt-token',
      };
      const context = createMockExecutionContext(headers, '/protected-route');

      mockReflector.get.mockReturnValue(['AutorizacionCamiones']);
      mockJwtService.verify.mockImplementation(() => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow('jwt expired');
    });

    it('should handle malformed token', async () => {
      const headers = {
        authorization: 'Bearer malformed-token',
      };
      const context = createMockExecutionContext(headers, '/protected-route');

      mockReflector.get.mockReturnValue(['AutorizacionCamiones']);
      mockJwtService.verify.mockImplementation(() => {
        const error = new Error('jwt malformed');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow('jwt malformed');
    });
  });
});
