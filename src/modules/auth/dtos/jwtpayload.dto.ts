import { Role } from '../enums/roles.enum';

export class JwtPayloadDto {
  username: string;
  sub: number; // Esto es el id del user xd
  roles: Role[];
}
