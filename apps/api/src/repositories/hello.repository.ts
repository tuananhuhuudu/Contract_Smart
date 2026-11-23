import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

/** Layer 3, data access (like repo_*.py): the only layer that talks to PostgreSQL. */
@Injectable()
export class HelloRepository {
  constructor(private readonly dataSource: DataSource) {}

  async now(): Promise<Date> {
    const rows: { now: Date }[] = await this.dataSource.query("SELECT now() AS now");
    const row = rows[0];
    if (!row) throw new Error("SELECT now() returned no row");
    return row.now;
  }
}
