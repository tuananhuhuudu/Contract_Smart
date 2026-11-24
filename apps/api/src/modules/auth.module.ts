import { Module } from "@nestjs/common";
import { AuthController } from "../api/v1/auth.controller";
import { UserRepository } from "../repositories/user.repository";
import { AccountsModule } from "./accounts.module";
import { AuthService } from "../services/auth.service";

/** Login, the current user and changing one's own password. Accounts are created by administrators (AccountsModule). */
@Module({ imports: [AccountsModule], controllers: [AuthController], providers: [AuthService, UserRepository] })
export class AuthModule {}
