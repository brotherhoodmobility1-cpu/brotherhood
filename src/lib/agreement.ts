import { formatDate, perDay, rupees } from "./format";
import { MIN_BALANCE } from "./status";

export type AgreementRider = {
  full_name: string; mobile: string | null; start_date: string | null; weekly_rent: number;
  security_deposit: number; code: string; chassis: string | null;
};

/** Fills {name}, {mobile}, {start}, {scooter}, {chassis}, {rent}, {daily}, {deposit}, {min} for one rider. */
export function fillAgreement(body: string, r: AgreementRider) {
  const v: Record<string, string> = {
    name: r.full_name, mobile: r.mobile ?? "(not set)", start: formatDate(r.start_date), scooter: r.code,
    chassis: r.chassis ?? "–", rent: rupees(r.weekly_rent), daily: rupees(perDay(r.weekly_rent)),
    deposit: rupees(r.security_deposit), min: rupees(MIN_BALANCE),
  };
  return body.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? v[k] : m));
}
