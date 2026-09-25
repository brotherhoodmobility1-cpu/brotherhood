const DAY = 86400000;
/** YYYY-MM-DD in India time for a timestamp (or now). */
export const istDate = (iso?: string) => new Date(iso ?? Date.now()).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
export const dayNum = (d: string) => Math.round(Date.parse(d + "T00:00:00Z") / DAY);
export const fromDayNum = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
export const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** dd/mm/yy, hh:mm in India time. */
export const whenIST = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
