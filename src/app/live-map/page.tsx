import AppShell from "@/components/app-shell";
import LiveRadar, { type Spot } from "@/components/live-radar";
import { requireTeam } from "@/lib/auth";

type Row = {
  id: string; full_name: string; mobile: string | null; scooters: { code: string } | null;
  rider_locations: { lat: number; lng: number; accuracy: number | null; updated_at: string } | { lat: number; lng: number; accuracy: number | null; updated_at: string }[] | null;
};

export default async function LiveMapPage() {
  const { supabase, profile } = await requireTeam();
  const [{ data: riders }, { data: settings }] = await Promise.all([
    supabase.from("riders").select("id, full_name, mobile, scooters(code), rider_locations(lat, lng, accuracy, updated_at)").eq("status", "active").order("scooter_id"),
    supabase.from("app_settings").select("key, value").in("key", ["hub_lat", "hub_lng"]),
  ]);
  const set = Object.fromEntries(((settings ?? []) as { key: string; value: string }[]).map((s) => [s.key, s.value]));
  const spots: Spot[] = ((riders ?? []) as unknown as Row[]).map((r) => {
    const loc = Array.isArray(r.rider_locations) ? r.rider_locations[0] ?? null : r.rider_locations;
    return { id: r.id, name: r.full_name, mobile: r.mobile, code: r.scooters?.code ?? "–", loc };
  });
  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <LiveRadar owner={profile.role === "owner"} spots={spots}
        hub={set.hub_lat ? { lat: Number(set.hub_lat), lng: Number(set.hub_lng), set: true } : { lat: 28.4595, lng: 77.0266, set: false }} />
    </AppShell>
  );
}
