import { Module } from "@nestjs/common";
import { AuthController } from "../api/v1/auth.controller";
import { UserRepository } from "../repositories/user.repository";
import { AuthService } from "../services/auth.service";

/** Login, self sign-up and the current user. */
@Module({ controllers: [AuthController], providers: [AuthService, UserRepository] })
export class AuthModule {}
