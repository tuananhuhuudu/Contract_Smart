import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { CoreModule } from "./core/core.module";
import { AuthGuard } from "./core/security/auth.guard";
import { SecurityModule } from "./core/security/security.module";
import { AccountsModule } from "./modules/accounts.module";
import { AuthModule } from "./modules/auth.module";
import { ContractTypesModule } from "./modules/contract-types.module";
import { ContractsModule } from "./modules/contracts.module";
import { EventTypesModule } from "./modules/event-types.module";
import { HelloModule } from "./modules/hello.module";
import { MilestoneLibraryModule } from "./modules/milestone-library.module";
import { PartiesModule } from "./modules/parties.module";

/** Root module: add one line per feature module. */
@Module({
  imports: [CoreModule, SecurityModule, AuthModule, AccountsModule, HelloModule, EventTypesModule, PartiesModule, MilestoneLibraryModule, ContractTypesModule, ContractsModule],
  // Every endpoint needs a login unless it is marked @Public(); @Roles() narrows it further.
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
