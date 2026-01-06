import { SetMetadata } from '@nestjs/common';

export const InternalPermissions = (...permissions: string[]) =>
  SetMetadata('internal-permissions', permissions);
