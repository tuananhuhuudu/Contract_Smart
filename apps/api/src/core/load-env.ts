// Loads apps/api/.env when present (Node built-in, no extra package). Imported first in main.ts,
// so every other module already sees the variables.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on the real environment.
}
