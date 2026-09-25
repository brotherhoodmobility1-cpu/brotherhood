import AppShell from "@/components/app-shell";
import AccessManager, { type TeamLogin, type RiderLogin } from "@/components/access-manager";
import { requireTeam } from "@/lib/auth";

type RiderRow = {
  id: string;
  full_name: string;
  mobile: string | null;
  profile_id: string | null;
  scooters: { code: string } | null;
  profiles: { must_change_password: boolean } | null;
};

export default async function AccessPage() {
  const { supabase, profile, userId } = await requireTeam(["owner"]);
  const [{ data: team }, { data: riders }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, mobile, role, must_change_password").neq("role", "rider").order("created_at"),
    supabase.from("riders")
      .select("id, full_name, mobile, profile_id, scooters(code), profiles(must_change_password)")
      .eq("status", "active")
      .order("scooter_id"),
  ]);
  const riderRows = ((riders ?? []) as unknown as RiderRow[]).map<RiderLogin>((r) => ({
    id: r.id,
    name: r.full_name,
    mobile: r.mobile,
    code: r.scooters?.code ?? "–",
    login: r.profile_id ? (r.profiles?.must_change_password ? "temp" : "set") : "none",
  }));

  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <AccessManager me={userId} team={(team ?? []) as TeamLogin[]} riders={riderRows} />
    </AppShell>
  );
}
