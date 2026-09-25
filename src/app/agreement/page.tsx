import AppShell from "@/components/app-shell";
import AgreementAdmin, { type SignRow } from "@/components/agreement-admin";
import { requireTeam } from "@/lib/auth";

type Signed = { rider_id: string; version: number; body: string; signed_at: string; mobile: string | null };

export default async function AgreementPage() {
  const { supabase, profile } = await requireTeam();
  const [{ data: tpl }, { data: riders }, { data: signed }] = await Promise.all([
    supabase.from("agreement_templates").select("version, body").order("version", { ascending: false }).limit(1).single(),
    supabase.from("riders").select("id, full_name, scooters(code)").eq("status", "active").order("scooter_id"),
    supabase.from("rider_agreements").select("rider_id, version, body, signed_at, mobile").order("version", { ascending: false }),
  ]);
  const current = tpl?.version ?? 1;
  const latest = new Map<string, Signed>();
  ((signed ?? []) as Signed[]).forEach((s) => { if (!latest.has(s.rider_id)) latest.set(s.rider_id, s); });
  const rows: SignRow[] = ((riders ?? []) as unknown as { id: string; full_name: string; scooters: { code: string } | null }[]).map((r) => {
    const s = latest.get(r.id);
    return { id: r.id, name: r.full_name, code: r.scooters?.code ?? "–", signed: s ?? null, state: !s ? "none" : s.version < current ? "old" : "ok" };
  });

  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <AgreementAdmin owner={profile.role === "owner"} version={current} body={tpl?.body ?? ""} rows={rows} />
    </AppShell>
  );
}
