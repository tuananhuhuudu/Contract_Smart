import { Module } from "@nestjs/common";
import { AccountsController } from "../api/v1/accounts.controller";
import { AccountService } from "../services/account.service";

/** Companies and accounts: the platform administrator opens companies, each company administrator manages its staff. */
@Module({ controllers: [AccountsController], providers: [AccountService], exports: [AccountService] })
export class AccountsModule {}
