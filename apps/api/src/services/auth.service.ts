import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { companyActive } from "../core/security/auth.guard";
import type { AuthUser } from "../core/security/decorators";
import { verifyPassword } from "../core/security/password";
import type { User } from "../models/user.entity";
import { UserRepository } from "../repositories/user.repository";
import type { LoginDto } from "../schemas/auth.schema";
import { AccountService } from "./account.service";
import { AuditService } from "./audit.service";

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

const toAuthUser = (u: User): AuthUser => ({ id: u.id, email: u.email, fullName: u.fullName, role: u.role, partyId: u.partyId });

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly accounts: AccountService,
  ) {}

  /** Same answer for an unknown email and a wrong password, so accounts cannot be guessed. */
  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.users.findWithPassword(dto.email);
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) return this.refuse("INVALID_CREDENTIALS", dto.email, user);
    if (!user.active) return this.refuse("ACCOUNT_DISABLED", dto.email, user);
    if (!(await companyActive(this.dataSource, user.partyId))) return this.refuse("ORGANIZATION_DISABLED", dto.email, user);
    return { accessToken: await this.jwt.signAsync({ sub: user.id }), user: toAuthUser(user) };
  }

  /** Logs the refused login (on the account's company when the email exists, so its administrator sees it), then refuses. */
  private async refuse(code: string, email: string, user: User | null): Promise<never> {
    await this.dataSource.transaction(async (db) => {
      await this.audit.record(db, null, {
        action: "LOGIN_FAILED", resource: "user", resourceId: user?.id ?? email.trim().toLowerCase(),
        organizationId: user ? await this.accounts.organizationOfParty(user.partyId, db) : null,
        after: { email: email.trim().toLowerCase() }, reason: code,
      });
    });
    throw new UnauthorizedException(code);
  }
}
