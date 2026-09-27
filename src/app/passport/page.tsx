import AppShell from "@/components/app-shell";
import PassportList, { type PassportRow } from "@/components/passport-list";
import AddScooter from "@/components/add-scooter";
import { requireTeam } from "@/lib/auth";
import type { SwapPlan } from "@/lib/passport";

type S = { id: number; code: string; chassis_no: string | null; reg_no: string | null; insurance_to: string | null; riders: { full_name: string; status: string }[] };

export default async function PassportPage() {
  const { supabase, profile } = await requireTeam();
  const [{ data: sc }, { data: pl }, { data: pp }] = await Promise.all([
    supabase.from("scooters").select("id, code, chassis_no, reg_no, insurance_to, riders(full_name, status)").neq("status", "retired").order("id"),
    supabase.from("swap_plans").select("*").order("starts_on", { ascending: false }),
    supabase.from("scooter_papers").select("scooter_id"),
  ]);
  const latest = new Map<number, SwapPlan>();
  ((pl ?? []) as SwapPlan[]).forEach((p) => { if (!latest.has(p.scooter_id)) latest.set(p.scooter_id, p); });
  const paperCount = new Map<number, number>();
  ((pp ?? []) as { scooter_id: number }[]).forEach((p) => paperCount.set(p.scooter_id, (paperCount.get(p.scooter_id) ?? 0) + 1));
  const rows: PassportRow[] = ((sc ?? []) as unknown as S[]).map((s) => ({
    id: s.id, code: s.code, chassis: s.chassis_no, reg: s.reg_no, insuranceTo: s.insurance_to,
    rider: s.riders.find((r) => r.status === "active")?.full_name ?? null,
    plan: latest.get(s.id) ?? null, papers: paperCount.get(s.id) ?? 0,
  }));
  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Scooter Passport</h2>
        <AddScooter />
      </div>
      <p className="mute">Each scooter&apos;s battery swap plan, insurance and papers in one place. Plans ending in 3 days or less and insurance ending in 15 days or less are flagged.</p>
      <PassportList rows={rows} owner={profile.role === "owner"} />
    </AppShell>
  );
}
