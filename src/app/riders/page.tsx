import AppShell from "@/components/app-shell";
import RidersManager, { type ActiveRider, type WaitingRider, type PastRider, type FreeScooter } from "@/components/riders-manager";
import { requireTeam } from "@/lib/auth";

export default async function RidersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, profile } = await requireTeam();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  const [act, wait, past, free, settings] = await Promise.all([
    supabase.from("riders")
      .select("id, full_name, mobile, start_date, weekly_rent, security_deposit, wallet_balance, action_needed, scooters(code, chassis_no)")
      .eq("status", "active").order("scooter_id"),
    supabase.from("riders").select("id, full_name, mobile, weekly_rent, security_deposit, created_at").eq("status", "waiting").order("created_at"),
    supabase.from("riders")
      .select("id, full_name, mobile, start_date, end_date, security_deposit, wallet_balance, return_charges, return_note, settlement, return_photos, scooters(code)")
      .eq("status", "closed").order("end_date", { ascending: false }).limit(100),
    supabase.from("scooters").select("id, code, chassis_no").eq("status", "available").order("id"),
    supabase.from("app_settings").select("key, value").in("key", ["upi_id", "qr_version"]),
  ]);
  const set = Object.fromEntries(((settings.data ?? []) as { key: string; value: string }[]).map((s) => [s.key, s.value]));
  const qrUrl = set.qr_version ? `${supabase.storage.from("brand").getPublicUrl("payment-qr.jpg").data.publicUrl}?v=${set.qr_version}` : null;

  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <RidersManager
        owner={profile.role === "owner"}
        active={(act.data ?? []) as unknown as ActiveRider[]}
        waiting={(wait.data ?? []) as WaitingRider[]}
        past={(past.data ?? []) as unknown as PastRider[]}
        free={(free.data ?? []) as FreeScooter[]}
        qrUrl={qrUrl}
        upiId={set.upi_id ?? ""}
        prefill={one("enquiry") ? { enquiry: Number(one("enquiry")), name: one("name"), mobile: one("mobile") } : null}
      />
    </AppShell>
  );
}
