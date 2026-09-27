import { handoverProblem, type HandoverInput } from "./handover";

export async function saveHandover(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, userId: string,
  v: { scooterId: number; riderId: string | null; kind: "allot" | "repair" | "return"; h: HandoverInput }
) {
  const p = handoverProblem(v.h);
  if (p) return p;
  const { error } = await supabase.from("handovers").insert({
    scooter_id: v.scooterId, rider_id: v.riderId, kind: v.kind, to_name: v.h.to_name.trim(), photos: v.h.photos,
    odometer_km: v.h.km, battery_pct: v.h.battery, checklist: v.h.checklist, created_by: userId,
  });
  return error ? error.message : "";
}
