import "reflect-metadata";
import path from "node:path";
import { DataSource, type DataSourceOptions } from "typeorm";

// The TypeORM CLI imports this file directly, so it loads apps/api/.env itself (Node built-in).
try {
  process.loadEnvFile(path.join(__dirname, "..", "..", ".env"));
} catch {
  // No .env file: rely on the real environment.
}

/** Connection used by the API (like core/database.py). Entities are the classes in src/models. */
export const databaseOptions: DataSourceOptions = {
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [path.join(__dirname, "..", "models", "*.entity.{ts,js}")],
  // Tables change only through migrations, never automatically.
  synchronize: false,
};

/** Used by the TypeORM CLI to generate and run migrations (like alembic.ini + env.py). */
export default new DataSource({
  ...databaseOptions,
  migrations: [path.join(__dirname, "..", "..", "migrations", "*.ts")],
});
