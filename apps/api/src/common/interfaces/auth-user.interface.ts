import { Role } from '../enums';

export interface AuthUser {
  id: string;
  orgId: string;
  role: Role;
  name: string;
  email: string;
}

export function isStaff(user: AuthUser) {
  return user.role === Role.ORG_ADMIN || user.role === Role.MANAGER;
}
