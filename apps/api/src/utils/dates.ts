/** Calendar dates as 'YYYY-MM-DD' strings (PostgreSQL date columns), computed in UTC so no time zone shifts them. */

export function addDays(isoDate: string, days: number): string {
  const time = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(time)) throw new Error(`Not a date: ${isoDate}`);
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10);
}
