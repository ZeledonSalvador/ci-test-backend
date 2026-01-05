import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { JwtPayloadDto } from '../dtos/jwtpayload.dto';
import { Role } from '../enums/roles.enum';
import { UsersService } from 'src/modules/users/services/users.service';
import { SKIP_CLIENT_VALIDATION_KEY } from '../decorators/skipClientValidation.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector, 
    private usersService: UsersService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<Role[]>('roles', context.getHandler());
    const skipClientValidation = this.reflector.get<boolean>(SKIP_CLIENT_VALIDATION_KEY, context.getHandler());
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    console.log('🌐 Endpoint que intenta acceder:', request.url);

    if (!authHeader) {
      throw new ForbiddenException('Falta el encabezado de autorización en la solicitud.');
    }


    const token = authHeader.split(' ')[1];

    try {
      const payload: JwtPayloadDto = this.jwtService.verify(token);
      const userRolesRequest: Role[] = payload.roles;

      // Asignar el usuario al request
      request.user = payload;
      console.log('🔐 Usuario agregado al request:', payload);

      // Verificar si el usuario tiene alguno de los roles requeridos
      console.log('Roles requeridos:', requiredRoles);
      console.log('Roles del token:', userRolesRequest);

      const hasRole = () => requiredRoles.some(role => userRolesRequest.includes(role));
      if (!hasRole()) {
        throw new ForbiddenException('No tiene permisos suficientes para realizar esta acción.');
      }
      request.isClient = false;

      if (userRolesRequest.includes(Role.CLIENT) && !skipClientValidation) {
        request.isClient = true;

        /* 
          Tratara de indentificar el cliente ya sea por el
          codigo de generacion de un shipment o por su codigo
          de cliente
        */


        const codeGen = this.getCodeGenFromRequest(request);
        const codeClient = this.getCodeClientFromRequest(request);
        const userClient = await this.usersService.handleGetUser(codeGen, codeClient);
        console.log("El user Client encontrado fue: ", userClient.username);

        if (payload.sub !== userClient.id) {
          throw new ForbiddenException('No tiene permisos para acceder a la información de otro usuario.');
        }

      }

      console.log("La peticion fue hecha por un rol ", userRolesRequest);

      return true;
    } catch (error) {
      console.log("Ocurrio un error en el Midleware de Authentication (AuthGuard) ", error);
      throw new ForbiddenException(error.message);
    }
  }


  private getCodeGenFromRequest(request: any): string | null {
    /* 
       Posibles nombres para de codigo de generacion de los campos, esta
       busqueda la hice asi por que seria mas dificil modificar cada endpoint
       para este midleware de auth
    */
    const codeGenFields = [
      'codeGen', 'code_gen', 'genCode', "codigo_gen"
    ];
    let codeGen = this.getFromFields(request, codeGenFields);

    return codeGen || null;
  }

  private getCodeClientFromRequest(request: any): string | null {
    const codeCliendFilds = ["codigo_ingenio", "ingenioCode", "codigoEmpresa"];
    let codigoIngenio = this.getFromFields(request, codeCliendFilds);
    return codigoIngenio || null;
  }

  /* 
    Esta es el metodo que hace la busqueda de los fiels en el
    source (en este caso el request) no buscara valores anidados

    este metodo busca tanto en el body de un post, en los parametros
    de la url y los parametros query de un metodo GET
  */
  private getFromFields(source: any, fields: string[]): string | null {
    for (const field of fields) {
      if (source.params && source.params[field]) {
        return source.params[field];
      }
      if (source.body && source.body[field]) {
        return source.body[field];
      }
      if (source.query && source.query[field]) {
        return source.query[field];
      }
    }
    return null;
  }

}