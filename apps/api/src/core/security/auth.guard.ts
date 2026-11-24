import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { Party } from "../../models/party.entity";
import { User, type UserRole } from "../../models/user.entity";
import { IS_PUBLIC, ROLES, type AuthUser } from "./decorators";

/** What the token carries; the role and party are read again from the database on every request. */
export interface TokenPayload {
  sub: string;
}

/** False when the user's company (or, for an approver, the buyer it belongs to) is locked. */
export async function companyActive(dataSource: DataSource, partyId: number | null): Promise<boolean> {
  if (partyId === null) return true;
  const party = await dataSource.getRepository(Party).findOneOrFail({ where: { id: partyId } });
  if (party.parentId === null) return party.active;
  return (await dataSource.getRepository(Party).findOneOrFail({ where: { id: party.parentId } })).active;
}

/**
 * Checks the Bearer token, loads the user (a locked account or a changed role takes effect at once),
 * then the roles of @Roles(). Endpoints marked @Public() skip it.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>();
    const [scheme, token] = (request.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !token) throw new UnauthorizedException("LOGIN_REQUIRED: send Authorization: Bearer <token>");
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token);
    } catch {
      throw new UnauthorizedException("INVALID_TOKEN: log in again");
    }
    const user = await this.dataSource.getRepository(User).findOne({ where: { id: payload.sub } });
    if (!user || !user.active) throw new UnauthorizedException("ACCOUNT_DISABLED");
    if (!(await companyActive(this.dataSource, user.partyId))) throw new UnauthorizedException("ORGANIZATION_DISABLED");
    request.user = { id: user.id, email: user.email, fullName: user.fullName, role: user.role, partyId: user.partyId };

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(user.role)) throw new ForbiddenException(`ROLE_NOT_ALLOWED: needs one of ${roles.join(", ")}`);
    return true;
  }
}
