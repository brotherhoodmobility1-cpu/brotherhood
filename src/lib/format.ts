export function formatDate(d: string | null) {
  if (!d) return "–";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

export function rupees(n: number | string | null) {
  const v = Number(n ?? 0);
  return (v < 0 ? "-₹" : "₹") + Math.abs(v).toLocaleString("en-IN");
}