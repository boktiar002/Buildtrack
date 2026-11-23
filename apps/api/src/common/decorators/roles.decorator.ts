import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums';

export const ROLES = 'roles';

/** Route is limited to these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
