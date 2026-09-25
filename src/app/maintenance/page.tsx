import AppShell from "@/components/app-shell";
import MaintenanceView from "@/components/maintenance-view";
import { requireTeam } from "@/lib/auth";
import { JOB_SELECT, type Job } from "@/lib/jobs";

type Scooter = { id: number; code: string; chassis_no: string | null; status: string; riders: { full_name: string; status: string }[] };

export default async function MaintenancePage() {
  const { supabase, profile } = await requireTeam();
  const [{ data: jobs }, { data: scooters }] = await Promise.all([
    supabase.from("jobs").select(JOB_SELECT).order("created_at", { ascending: false }).limit(1000),
    supabase.from("scooters").select("id, code, chassis_no, status, riders(full_name, status)").order("id"),
  ]);
  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <MaintenanceView owner={profile.role === "owner"} jobs={(jobs ?? []) as unknown as Job[]} scooters={(scooters ?? []) as unknown as Scooter[]} />
    </AppShell>
  );
}
