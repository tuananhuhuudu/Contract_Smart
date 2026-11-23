/** Calendar dates as 'YYYY-MM-DD' strings (PostgreSQL date columns), computed in UTC so no time zone shifts them. */

export function addDays(isoDate: string, days: number): string {
  const time = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(time)) throw new Error(`Not a date: ${isoDate}`);
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10);
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** Current wall-clock time in Vietnam as 'YYYY-MM-DDTHH:MM:SS' (events store local time without a zone). */
export function nowInVietnam(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

/**
 * Keeps a `timestamp` (without time zone) column as the wall-clock text it was written with. Without it
 * TypeORM turns the value into a Date in the server's zone and comparisons shift by hours.
 */
export const wallClock = {
  to: (value: string | undefined) => value,
  from: (value: Date | string | null) =>
    value instanceof Date
      ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
      : value,
};
