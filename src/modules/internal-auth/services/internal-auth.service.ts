import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { InternalUsers } from 'src/models/InternalUsers';
import { Permissions } from 'src/models/Permissions';
import { UserWeighbridges } from 'src/models/UserWeighbridges';
import { SessionsLogs } from 'src/models/SessionsLogs';
import { InternalLoginDto } from '../dtos/internal-login.dto';
import { CreateUserDto } from '../dtos/create-user.dto';

@Injectable()
export class InternalAuthService {
  constructor(
    @InjectRepository(InternalUsers)
    private readonly userRepository: Repository<InternalUsers>,
    @InjectRepository(Permissions)
    private readonly permissionsRepository: Repository<Permissions>,
    @InjectRepository(UserWeighbridges)
    private readonly weighbridgesRepository: Repository<UserWeighbridges>,
    @InjectRepository(SessionsLogs)
    private readonly sessionsLogsRepository: Repository<SessionsLogs>,
    private readonly jwtService: JwtService,
  ) {}

  private async logSessionAttempt(data: {
    codUsuario?: number;
    username: string;
    sessionToken?: string;
    tokenExpiration?: Date;
    codBascula?: number;
    codTurno?: number;
    isSuccessful: boolean;
    message: string;
  }) {
    try {
      await this.sessionsLogsRepository.save({
        codUsuario: data.codUsuario || null,
        username: data.username,
        sessionToken: data.sessionToken || null,
        tokenExpiration: data.tokenExpiration || null,
        codBascula: data.codBascula || null,
        codTurno: data.codTurno || null,
        isSuccessful: data.isSuccessful,
        message: data.message,
      });
      console.log(`[INTERNAL-AUTH] Session log guardado - ${data.message}`);
    } catch (error) {
      console.log(
        `[INTERNAL-AUTH] Error guardando session log: ${error.message}`,
      );
    }
  }

  private async getPermissions(userId: number) {
    // Raw SQL para máximo rendimiento
    const permissionsData = await this.permissionsRepository.query(
      `
      SELECT
        m.name as module,
        m.display_name as displayName,
        m.icon as icon,
        m.is_visible as isVisible,
        p.actions as actions
      FROM Permissions p
      INNER JOIN Modules m ON m.id = p.id_module
      WHERE p.id_user = @0
        AND m.active = 1
      ORDER BY m.order_index ASC
    `,
      [userId],
    );

    return permissionsData.map((p: any) => {
      let actions = [];
      try {
        actions = JSON.parse(p.actions);
      } catch (error) {
        console.error(
          `⚠️ Error al parsear actions para el módulo ${p.module}:`,
          error.message,
        );
        actions = []; // Valor por defecto si falla el parse
      }

      return {
        module: p.module,
        displayName: p.displayName,
        route: p.module,
        icon: p.icon,
        isVisible: Boolean(p.isVisible),
        actions,
      };
    });
  }

  async login(loginDto: InternalLoginDto): Promise<any> {
    const { username, password, bascula, turno } = loginDto;
    const startTime = Date.now();

    console.log('[INTERNAL-AUTH] Intento de login');
    console.log(`[INTERNAL-AUTH] Usuario: ${username}`);
    console.log(`[INTERNAL-AUTH] Bascula: ${bascula || 'No especificada'}`);

    try {
      // 1. Buscar usuario con relaciones Y básculas en una sola query (case-sensitive)
      const queryStart = Date.now();
      const user = await this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .leftJoinAndSelect('role.category', 'category')
        .leftJoinAndSelect(
          'user.weighbridges',
          'weighbridges',
          'weighbridges.active = :wActive',
          { wActive: true },
        )
        .where('user.username = :username COLLATE Latin1_General_CS_AS', {
          username,
        })
        .andWhere('user.active = :active', { active: true })
        .getOne();
      console.log(
        `[INTERNAL-AUTH] Query usuario: ${Date.now() - queryStart}ms`,
      );

      if (!user) {
        console.log(
          `[INTERNAL-AUTH] FALLO - Usuario no encontrado: ${username}`,
        );

        // Log intento fallido
        this.logSessionAttempt({
          username,
          codBascula: bascula ? parseInt(bascula) : undefined,
          codTurno: turno ? parseInt(turno) : undefined,
          isSuccessful: false,
          message: 'Usuario no encontrado o inactivo',
        });

        throw new UnauthorizedException(
          'Usuario o contraseña incorrectos. Por favor verifica tus credenciales.',
        );
      }

      console.log(`[INTERNAL-AUTH] Usuario encontrado - ID: ${user.id}`);
      console.log(
        `[INTERNAL-AUTH] Username DB: ${user.username} | Username Request: ${username}`,
      );

      // 2. Validar que el rol esté activo
      if (!user.role || !user.role.active) {
        console.log(
          `[INTERNAL-AUTH] FALLO - Rol inactivo para usuario: ${username}`,
        );

        // Log intento fallido
        this.logSessionAttempt({
          codUsuario: user.id,
          username,
          codBascula: bascula ? parseInt(bascula) : undefined,
          codTurno: turno ? parseInt(turno) : undefined,
          isSuccessful: false,
          message: 'Rol inactivo',
        });

        throw new UnauthorizedException(
          'Usuario o contraseña incorrectos. Por favor verifica tus credenciales.',
        );
      }

      // 3. Validar que la categoría esté activa
      if (!user.role.category || !user.role.category.active) {
        console.log(
          `[INTERNAL-AUTH] FALLO - Categoria inactiva para usuario: ${username}`,
        );

        // Log intento fallido
        this.logSessionAttempt({
          codUsuario: user.id,
          username,
          codBascula: bascula ? parseInt(bascula) : undefined,
          codTurno: turno ? parseInt(turno) : undefined,
          isSuccessful: false,
          message: 'Categoría inactiva',
        });

        throw new UnauthorizedException(
          'Usuario o contraseña incorrectos. Por favor verifica tus credenciales.',
        );
      }

      console.log(`[INTERNAL-AUTH] Rol y categoría activos`);

      // 4. Validar contraseña
      const bcryptStart = Date.now();
      const isPasswordValid = await bcrypt.compare(
        password,
        user.password.toString(),
      );
      console.log(
        `[INTERNAL-AUTH] Bcrypt compare: ${Date.now() - bcryptStart}ms`,
      );

      if (!isPasswordValid) {
        console.log(
          `[INTERNAL-AUTH] FALLO - Contraseña incorrecta para usuario: ${username}`,
        );

        // Log intento fallido
        this.logSessionAttempt({
          codUsuario: user.id,
          username,
          codBascula: bascula ? parseInt(bascula) : undefined,
          codTurno: turno ? parseInt(turno) : undefined,
          isSuccessful: false,
          message: 'Contraseña inválida',
        });

        throw new UnauthorizedException(
          'Usuario o contraseña incorrectos. Por favor verifica tus credenciales.',
        );
      }

      console.log(`[INTERNAL-AUTH] Contraseña validada correctamente`);

      // 5. Extraer weighbridgeIds de la relación cargada
      const weighbridgeIds =
        user.weighbridges?.map((w) => w.weighbridgeId) || [];
      console.log(
        `[INTERNAL-AUTH] Basculas asignadas: [${weighbridgeIds.join(', ')}]`,
      );

      // 6. Verificar acceso a báscula (si se proporciona) usando datos ya cargados
      if (bascula) {
        const weighbridgeId = parseInt(bascula);
        const hasWeighbridgeAccess = weighbridgeIds.includes(weighbridgeId);

        if (!hasWeighbridgeAccess) {
          console.log(
            `[INTERNAL-AUTH] FALLO - Usuario ${username} sin acceso a bascula ${bascula}`,
          );

          // Log intento fallido
          this.logSessionAttempt({
            codUsuario: user.id,
            username,
            codBascula: weighbridgeId,
            codTurno: turno ? parseInt(turno) : undefined,
            isSuccessful: false,
            message: `No tiene acceso a la báscula ${bascula}`,
          });

          throw new UnauthorizedException(
            'No tienes acceso a la báscula seleccionada',
          );
        }

        console.log(`[INTERNAL-AUTH] Acceso a bascula ${bascula} validado`);
      }

      // 7. Obtener permisos del usuario
      const permStart = Date.now();
      const permissions = await this.getPermissions(user.id);
      console.log(
        `[INTERNAL-AUTH] Query permisos: ${Date.now() - permStart}ms`,
      );
      console.log(
        `[INTERNAL-AUTH] Permisos cargados: ${permissions.length} modulos`,
      );

      // 8. Validar que el usuario tenga al menos un módulo activo
      if (permissions.length === 0) {
        console.log(
          `[INTERNAL-AUTH] FALLO - Usuario sin permisos activos: ${username}`,
        );

        // Log intento fallido
        this.logSessionAttempt({
          codUsuario: user.id,
          username,
          codBascula: bascula ? parseInt(bascula) : undefined,
          codTurno: turno ? parseInt(turno) : undefined,
          isSuccessful: false,
          message: 'Sin permisos activos',
        });

        throw new UnauthorizedException(
          'No tienes permisos asignados. Contacta al administrador',
        );
      }

      // 9. Actualizar último acceso (async sin await para no bloquear)
      this.userRepository.update(user.id, { lastAccess: new Date() });

      // 10. Generar JWT
      const payload = {
        userId: user.id,
        username: user.username,
        roleName: user.role.name,
        categoryName: user.role.category.name,
        weighbridge: bascula,
      };

      const token = this.jwtService.sign(payload);
      const tokenExpiration = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 horas

      const totalTime = Date.now() - startTime;
      console.log(`[INTERNAL-AUTH] TIEMPO TOTAL LOGIN: ${totalTime}ms`);
      console.log(
        `[INTERNAL-AUTH] EXITO - Login completado para usuario: ${username}`,
      );
      console.log(`[INTERNAL-AUTH] Rol: ${user.role.name}`);
      console.log(`[INTERNAL-AUTH] Categoria: ${user.role.category.name}`);
      console.log(
        `[INTERNAL-AUTH] Token expira: ${tokenExpiration.toISOString()}`,
      );
      if (turno) console.log(`[INTERNAL-AUTH] Turno: ${turno}`);

      // 11. Preparar response exitoso
      const successResponse = {
        success: true,
        message: 'Autenticación exitosa',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            category: {
              id: user.role.category.id,
              name: user.role.category.name,
            },
            role: {
              id: user.role.id,
              name: user.role.name,
            },
            weighbridges: weighbridgeIds,
            isActive: user.active,
            createdAt: user.createdAt,
            lastAccess: user.lastAccess,
          },
          permissions,
          token,
          tokenExpiration,
        },
      };

      // 12. Registrar sesión exitosa en logs (async sin await para no bloquear)
      this.logSessionAttempt({
        codUsuario: user.id,
        username: user.username,
        sessionToken: token,
        tokenExpiration: tokenExpiration,
        codBascula: bascula ? parseInt(bascula) : undefined,
        codTurno: turno ? parseInt(turno) : undefined,
        isSuccessful: true,
        message: 'Autenticación exitosa',
      });

      return successResponse;
    } catch (error) {
      // Si es un error de autorización, ya fue loggeado antes del throw
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Para cualquier otro error inesperado
      console.log(`[INTERNAL-AUTH] ERROR INESPERADO: ${error.message}`);

      this.logSessionAttempt({
        username,
        codBascula: bascula ? parseInt(bascula) : undefined,
        codTurno: turno ? parseInt(turno) : undefined,
        isSuccessful: false,
        message: 'Error interno del servidor',
      });

      throw error;
    }
  }

  async createUser(createUserDto: CreateUserDto): Promise<any> {
    console.log('[INTERNAL-AUTH] Intento de crear usuario');
    console.log(`[INTERNAL-AUTH] Username: ${createUserDto.username}`);
    console.log(
      `[INTERNAL-AUTH] Email: ${createUserDto.email || 'No especificado'}`,
    );
    console.log(
      `[INTERNAL-AUTH] Full Name: ${createUserDto.fullName || 'No especificado'}`,
    );

    // Verificar si el usuario ya existe
    const existingUser = await this.userRepository.findOne({
      where: { username: createUserDto.username },
    });

    if (existingUser) {
      console.log(
        `[INTERNAL-AUTH] FALLO - Usuario ya existe: ${createUserDto.username}`,
      );
      throw new ConflictException('El nombre de usuario ya existe');
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    console.log(`[INTERNAL-AUTH] Contraseña encriptada correctamente`);

    // Crear usuario
    const user = this.userRepository.create({
      username: createUserDto.username,
      email: createUserDto.email,
      fullName: createUserDto.fullName,
      idRole: createUserDto.idRole,
      password: Buffer.from(hashedPassword),
      active: true,
    });

    const savedUser = await this.userRepository.save(user);
    console.log(`[INTERNAL-AUTH] Usuario creado - ID: ${savedUser.id}`);

    // Asignar básculas si existen
    if (createUserDto.weighbridges && createUserDto.weighbridges.length > 0) {
      const weighbridges = createUserDto.weighbridges.map((weighbridgeId) =>
        this.weighbridgesRepository.create({
          idUser: savedUser.id,
          weighbridgeId,
          active: true,
        }),
      );
      await this.weighbridgesRepository.save(weighbridges);
      console.log(
        `[INTERNAL-AUTH] Basculas asignadas: [${createUserDto.weighbridges.join(', ')}]`,
      );
    }

    // Asignar permisos si existen
    if (createUserDto.permissions && createUserDto.permissions.length > 0) {
      const permissions = createUserDto.permissions.map((perm) =>
        this.permissionsRepository.create({
          idUser: savedUser.id,
          idModule: perm.moduleId,
          actions: JSON.stringify(perm.actions),
        }),
      );
      await this.permissionsRepository.save(permissions);
      console.log(
        `[INTERNAL-AUTH] Permisos asignados: ${createUserDto.permissions.length} modulos`,
      );
    }

    console.log(
      `[INTERNAL-AUTH] EXITO - Usuario creado completamente: ${createUserDto.username}`,
    );

    // Retornar respuesta sin password
    return {
      success: true,
      message: 'Usuario creado exitosamente',
      data: {
        id: savedUser.id,
        username: savedUser.username,
        email: savedUser.email,
        fullName: savedUser.fullName,
        idRole: savedUser.idRole,
        active: savedUser.active,
        createdAt: savedUser.createdAt,
        weighbridges: createUserDto.weighbridges || [],
        permissionsCount: createUserDto.permissions?.length || 0,
      },
    };
  }

  async validateToken(token: string) {
    const startTime = Date.now();
    console.log('[INTERNAL-AUTH] Validando token');

    if (!token) {
      console.log('[INTERNAL-AUTH] FALLO - Token no proporcionado');
      throw new UnauthorizedException('Token no proporcionado');
    }

    try {
      // 1. Verificar JWT (sin DB)
      const jwtStart = Date.now();
      const payload = this.jwtService.verify(token);
      console.log(`[INTERNAL-AUTH] JWT verify: ${Date.now() - jwtStart}ms`);
      console.log(`[INTERNAL-AUTH] Usuario ID: ${payload.userId}`);

      // 2. Query combinada: usuario + role + category + weighbridges
      const queryStart = Date.now();
      const user = await this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .leftJoinAndSelect('role.category', 'category')
        .leftJoinAndSelect(
          'user.weighbridges',
          'weighbridges',
          'weighbridges.active = :wActive',
          { wActive: true },
        )
        .where('user.id = :userId', { userId: payload.userId })
        .andWhere('user.active = :active', { active: true })
        .getOne();
      console.log(
        `[INTERNAL-AUTH] Query usuario+weighbridges: ${Date.now() - queryStart}ms`,
      );

      if (!user) {
        console.log('[INTERNAL-AUTH] FALLO - Usuario no encontrado o inactivo');
        throw new UnauthorizedException('Usuario no encontrado o inactivo');
      }

      // 3. Obtener permisos actualizados
      const permStart = Date.now();
      const permissions = await this.getPermissions(user.id);
      console.log(
        `[INTERNAL-AUTH] Query permisos: ${Date.now() - permStart}ms`,
      );

      // 4. Extraer weighbridgeIds de la relación ya cargada
      const weighbridgeIds =
        user.weighbridges?.map((w) => w.weighbridgeId) || [];

      const totalTime = Date.now() - startTime;
      console.log(`[INTERNAL-AUTH] TIEMPO TOTAL VERIFY-TOKEN: ${totalTime}ms`);
      console.log('[INTERNAL-AUTH] EXITO - Token validado correctamente');

      return {
        success: true,
        message: 'Token válido',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            category: {
              id: user.role.category.id,
              name: user.role.category.name,
            },
            role: {
              id: user.role.id,
              name: user.role.name,
            },
            weighbridges: weighbridgeIds,
            isActive: user.active,
          },
          permissions,
          tokenPayload: payload,
        },
      };
    } catch (error) {
      console.log(
        `[INTERNAL-AUTH] FALLO - Error al validar token: ${error.message}`,
      );
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  async updateUser(userId: number, updateUserDto: any): Promise<any> {
    console.log('[INTERNAL-AUTH] Actualizando usuario');
    console.log(`[INTERNAL-AUTH] Usuario ID: ${userId}`);

    // Verificar que el usuario existe
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      console.log(`[INTERNAL-AUTH] FALLO - Usuario no encontrado: ${userId}`);
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Actualizar datos básicos del usuario
    const updateData: any = {};

    if (updateUserDto.username) {
      // Verificar que el nuevo username no esté en uso
      const existingUser = await this.userRepository.findOne({
        where: { username: updateUserDto.username },
      });

      if (existingUser && existingUser.id !== userId) {
        console.log(
          `[INTERNAL-AUTH] FALLO - Username ya existe: ${updateUserDto.username}`,
        );
        throw new ConflictException('El nombre de usuario ya está en uso');
      }
      updateData.username = updateUserDto.username;
    }

    if (updateUserDto.email !== undefined) {
      updateData.email = updateUserDto.email;
    }

    if (updateUserDto.fullName !== undefined) {
      updateData.fullName = updateUserDto.fullName;
    }

    if (updateUserDto.idRole !== undefined) {
      updateData.idRole = updateUserDto.idRole;
    }

    if (updateUserDto.active !== undefined) {
      updateData.active = updateUserDto.active;
    }

    if (updateUserDto.password) {
      const hashedPassword = await bcrypt.hash(updateUserDto.password, 10);
      updateData.password = Buffer.from(hashedPassword);
      console.log('[INTERNAL-AUTH] Contraseña actualizada');
    }

    // Actualizar usuario en DB
    if (Object.keys(updateData).length > 0) {
      await this.userRepository.update(userId, updateData);
      console.log(`[INTERNAL-AUTH] Datos de usuario actualizados`);
    }

    // Actualizar básculas si se proporcionan
    if (updateUserDto.weighbridges !== undefined) {
      await this.weighbridgesRepository.delete({ idUser: userId });

      if (updateUserDto.weighbridges.length > 0) {
        const weighbridges = updateUserDto.weighbridges.map((weighbridgeId) =>
          this.weighbridgesRepository.create({
            idUser: userId,
            weighbridgeId,
            active: true,
          }),
        );
        await this.weighbridgesRepository.save(weighbridges);
        console.log(
          `[INTERNAL-AUTH] Basculas actualizadas: [${updateUserDto.weighbridges.join(', ')}]`,
        );
      }
    }

    // Actualizar permisos si se proporcionan
    if (updateUserDto.permissions !== undefined) {
      await this.permissionsRepository.delete({ idUser: userId });

      if (updateUserDto.permissions.length > 0) {
        const permissions = updateUserDto.permissions.map((perm) =>
          this.permissionsRepository.create({
            idUser: userId,
            idModule: perm.moduleId,
            actions: JSON.stringify(perm.actions),
          }),
        );
        await this.permissionsRepository.save(permissions);
        console.log(
          `[INTERNAL-AUTH] Permisos actualizados: ${updateUserDto.permissions.length} modulos`,
        );
      }
    }

    // Obtener usuario actualizado
    const updatedUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role', 'role.category'],
    });

    // Obtener básculas
    const weighbridges = await this.weighbridgesRepository.find({
      where: { idUser: userId, active: true },
      select: ['weighbridgeId'],
    });

    const weighbridgeIds = weighbridges.map((w) => w.weighbridgeId);

    // Obtener permisos
    const permissions = await this.getPermissions(userId);

    console.log(
      `[INTERNAL-AUTH] EXITO - Usuario actualizado: ${updatedUser.username}`,
    );

    return {
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: {
          id: updatedUser.role.id,
          name: updatedUser.role.name,
        },
        category: {
          id: updatedUser.role.category.id,
          name: updatedUser.role.category.name,
        },
        active: updatedUser.active,
        weighbridges: weighbridgeIds,
        permissions,
        updatedAt: updatedUser.updatedAt,
      },
    };
  }
}
