import "reflect-metadata";
import path from "node:path";
import { types } from "pg";
import { DataSource, type DataSourceOptions } from "typeorm";

// The TypeORM CLI imports this file directly, so it loads apps/api/.env itself (Node built-in).
try {
  process.loadEnvFile(path.join(__dirname, "..", "..", ".env"));
} catch {
  // No .env file: rely on the real environment.
}

// A "timestamp without time zone" is a wall-clock time (event_timestamp): return it as written,
// "2026-06-06T10:20:00", instead of a Date shifted by the server's time zone.
types.setTypeParser(1114, (value: string) => value.replace(" ", "T"));

/** Connection used by the API (like core/database.py). Entities are the classes in src/models. */
export const databaseOptions: DataSourceOptions = {
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [path.join(__dirname, "..", "models", "*.entity.{ts,js}")],
  // Tables change only through migrations, never automatically.
  synchronize: false,
  uuidExtension: "pgcrypto", // gen_random_uuid() is built into Postgres 13+, no extension needed
};

/** Used by the TypeORM CLI to generate and run migrations (like alembic.ini + env.py). */
export default new DataSource({
  ...databaseOptions,
  migrations: [path.join(__dirname, "..", "..", "migrations", "*.ts")],
});
