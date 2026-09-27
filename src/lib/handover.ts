export const HANDOVER_SLOTS: [string, string][] = [
  ["front", "Front"], ["back", "Back"], ["left", "Left side"], ["right", "Right side"], ["with", "Scooter with the person receiving it"],
];
export const CHECKLIST = ["Keys", "Charger", "Helmet", "Mirrors", "Number plate fitted"];

export type HandoverInput = {
  to_name: string;
  photos: Record<string, string>;
  km: number | null;
  battery: number | null;
  checklist: Record<string, boolean>;
};

export type HandoverRow = {
  id: number; scooter_id: number; rider_id: string | null; kind: string; to_name: string; photos: Record<string, string>;
  odometer_km: number | null; battery_pct: number | null; checklist: Record<string, boolean> | null;
  created_at: string; rider_confirmed_at: string | null;
};

export const KIND_LABEL: Record<string, string> = { allot: "Handed to rider", repair: "Handed back after repair", return: "Returned by rider" };

export function handoverProblem(h: HandoverInput) {
  const miss = HANDOVER_SLOTS.filter(([k]) => !h.photos[k]).length;
  if (miss) return `Add all 5 photos (${miss} missing).`;
  if (!h.to_name.trim()) return "Enter who is receiving the scooter.";
  return "";
}
