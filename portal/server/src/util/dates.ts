/** The agency works in South African time, so "today" must not flip at 02:00 local because the server runs on UTC. */
export const TZ = "Africa/Johannesburg";

export const todayZA = (now: Date = new Date()): string => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

/** Adds days to an ISO date (YYYY-MM-DD) without any timezone surprises. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const daysInMonth = (y: number, m1: number) => new Date(Date.UTC(y, m1, 0)).getUTCDate();

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** The same day next month, clamped to the month's length. `day` of 0 means the last day. */
export function nextMonthly(iso: string, day: number): string {
  let y = Number(iso.slice(0, 4));
  let m = Number(iso.slice(5, 7)) + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  const dim = daysInMonth(y, m);
  const d = day === 0 ? dim : Math.min(day, dim);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
