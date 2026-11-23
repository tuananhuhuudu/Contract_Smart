import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthUser } from "../core/security/decorators";
import { hashPassword, verifyPassword } from "../core/security/password";
import type { User } from "../models/user.entity";
import { UserRepository } from "../repositories/user.repository";
import type { LoginDto, RegisterDto } from "../schemas/auth.schema";

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
  ) {}

  /** Same answer for an unknown email and a wrong password, so accounts cannot be guessed. */
  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.users.findWithPassword(dto.email);
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) throw new UnauthorizedException("INVALID_CREDENTIALS");
    if (!user.active) throw new UnauthorizedException("ACCOUNT_DISABLED");
    return { accessToken: await this.jwt.signAsync({ sub: user.id }), user: toAuthUser(user) };
  }

  /** Self sign-up gives a read-only AUDITOR account with no party; an administrator assigns the real role. */
  async register(dto: RegisterDto): Promise<LoginResult> {
    const user = await this.users.create({ email: dto.email, passwordHash: await hashPassword(dto.password), fullName: dto.fullName.trim(), role: "AUDITOR", partyId: null });
    return { accessToken: await this.jwt.signAsync({ sub: user.id }), user: toAuthUser(user) };
  }
}
