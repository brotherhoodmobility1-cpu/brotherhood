import { istDate } from "./ist";

export type SwapPlan = {
  id: number; scooter_id: number; provider: string | null; plan_name: string | null; amount: number | null;
  swaps_total: number | null; swaps_used: number; kwh: number | null; starts_on: string; ends_on: string; slip_path: string | null; created_at: string;
};

export const PAPER_KINDS: [string, string][] = [
  ["rc", "RC (registration)"], ["number_plate", "Number plate"], ["chassis", "Chassis number photo"],
  ["insurance", "Insurance copy"], ["battery_slip", "Battery slip"], ["other", "Other"],
];

/** Whole days from today (India time) until the date. Negative = already passed. */
export function daysLeft(date: string | null) {
  if (!date) return null;
  return Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(istDate() + "T00:00:00Z")) / 86400000);
}

/** Tag colour and text for something that expires. */
export function expiryTag(date: string | null, soon: number): [string, string] {
  const d = daysLeft(date);
  if (d == null) return ["due", "Not added"];
  if (d < 0) return ["bad", `Expired ${-d} ${-d === 1 ? "day" : "days"} ago`];
  if (d === 0) return ["bad", "Ends today"];
  if (d <= soon) return ["due", `${d} ${d === 1 ? "day" : "days"} left`];
  return ["", `${d} days left`];
}

export const SWAP_SOON = 3;
export const INSURANCE_SOON = 15;
