import { Injectable } from "@nestjs/common";
import { PrismaService } from "../core/prisma.service";

/** Layer 3, data access (like repo_*.py): the only layer that talks to PostgreSQL. */
@Injectable()
export class HelloRepository {
  constructor(private readonly prisma: PrismaService) {}

  async now(): Promise<Date> {
    const rows = await this.prisma.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
    const row = rows[0];
    if (!row) throw new Error("SELECT now() returned no row");
    return row.now;
  }
}
