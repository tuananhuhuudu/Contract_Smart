import { createParamDecorator, SetMetadata, type ExecutionContext } from "@nestjs/common";
import type { UserRole } from "../../models/user.entity";

/** Who is calling, taken from the verified token and the users table (never from the request body). */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  partyId: number | null;
}

export const IS_PUBLIC = "isPublic";
export const ROLES = "roles";

/** The endpoint needs no login (login). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Only these roles may call the endpoint (checked by AuthGuard after the token). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

/** Injects the logged-in user into a controller method. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser =>
  ctx.switchToHttp().getRequest<{ user: AuthUser }>().user);
