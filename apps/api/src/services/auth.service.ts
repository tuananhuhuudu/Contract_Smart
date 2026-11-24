import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { companyActive } from "../core/security/auth.guard";
import type { AuthUser } from "../core/security/decorators";
import { verifyPassword } from "../core/security/password";
import type { User } from "../models/user.entity";
import { UserRepository } from "../repositories/user.repository";
import type { LoginDto } from "../schemas/auth.schema";

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
  ) {}

  /** Same answer for an unknown email and a wrong password, so accounts cannot be guessed. */
  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.users.findWithPassword(dto.email);
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) throw new UnauthorizedException("INVALID_CREDENTIALS");
    if (!user.active) throw new UnauthorizedException("ACCOUNT_DISABLED");
    if (!(await companyActive(this.dataSource, user.partyId))) throw new UnauthorizedException("ORGANIZATION_DISABLED");
    return { accessToken: await this.jwt.signAsync({ sub: user.id }), user: toAuthUser(user) };
  }
}
