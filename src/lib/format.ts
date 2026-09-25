export function formatDate(d: string | null) {
  if (!d) return "–";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

export function rupees(n: number | string | null) {
  const v = Number(n ?? 0);
  return (v < 0 ? "-₹" : "₹") + Math.abs(v).toLocaleString("en-IN");
}

export function perDay(weeklyRent: number | string) {
  return Math.round(Number(weeklyRent) / 7);
}

/** Rent is due on day 7 of each week from the start date (start 01/09 → due 07/09, 14/09 …). Returns YYYY-MM-DD. */
export function nextDue(start: string | null) {
  if (!start) return null;
  const DAY = 86400000;
  const s = Date.parse(start + "T00:00:00Z");
  const today = Date.parse(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00Z");
  const days = Math.round((today - s) / DAY) - 6;
  const due = s + (6 + Math.max(0, Math.ceil(days / 7)) * 7) * DAY;
  return new Date(due).toISOString().slice(0, 10);
}
