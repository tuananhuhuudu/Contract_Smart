import type { EntityManager } from "typeorm";

/**
 * Next business code of a table, for example CT0101 after CT0100. Takes a transaction-scoped
 * advisory lock first, so two requests creating rows at the same time never get the same code.
 * `table` and `column` are constants from our code, never user input.
 */
export async function nextCode(
  db: EntityManager,
  table: string,
  column: string,
  prefix: string,
  width: number,
): Promise<string> {
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${table}.${column}`]);
  const rows: { max: number | null }[] = await db.query(
    `SELECT max(substring("${column}" FROM $1::int)::int) AS max FROM "${table}" WHERE "${column}" ~ $2`,
    [prefix.length + 1, `^${prefix}[0-9]+$`],
  );
  const next = (rows[0]?.max ?? 0) + 1;
  return `${prefix}${String(next).padStart(width, "0")}`;
}

/** Several consecutive codes after the current maximum (all milestones of a new contract). */
export async function nextCodes(
  db: EntityManager,
  table: string,
  column: string,
  prefix: string,
  width: number,
  count: number,
): Promise<string[]> {
  const first = await nextCode(db, table, column, prefix, width);
  const start = Number(first.slice(prefix.length));
  return Array.from({ length: count }, (_, i) => `${prefix}${String(start + i).padStart(width, "0")}`);
}
