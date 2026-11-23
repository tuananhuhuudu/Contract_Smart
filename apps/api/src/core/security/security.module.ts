import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthGuard } from "./auth.guard";

/** JWT signing and the AuthGuard, available to every module. */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error("JWT_SECRET is not set (apps/api/.env)");
        return { secret, signOptions: { expiresIn: "8h" } };
      },
    }),
  ],
  providers: [AuthGuard],
  exports: [JwtModule, AuthGuard],
})
export class SecurityModule {}
