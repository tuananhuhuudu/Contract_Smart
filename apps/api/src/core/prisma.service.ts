import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

/**
 * The one database connection of the API (like core/database.py in the chatbot).
 * Repositories receive it by dependency injection; nobody creates their own client.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/**
 * Either the shared client or the client of a running transaction. Repository methods take an
 * optional `DbClient`, so a service can run several of them inside one `prisma.$transaction`.
 */
export type DbClient = PrismaService | Prisma.TransactionClient;
