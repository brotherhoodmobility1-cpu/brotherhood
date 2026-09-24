import AppShell from "@/components/app-shell";
import FleetLot, { type Bay } from "@/components/fleet-lot";
import { requireTeam } from "@/lib/auth";
import { scooterStatus } from "@/lib/status";

type Row = {
  id: number;
  code: string;
  status: string;
  riders: { full_name: string; status: string; wallet_balance: number; action_needed: boolean }[];
};

export default async function FleetPage() {
  const { supabase, profile } = await requireTeam();
  const { data } = await supabase
    .from("scooters")
    .select("id, code, status, riders(full_name, status, wallet_balance, action_needed)")
    .order("id");
  const rows = (data ?? []) as unknown as Row[];
  const bays: Bay[] = rows.map((s) => {
    const rider = s.riders.find((r) => r.status === "active") ?? null;
    const [kind, label] = scooterStatus(s.status, rider);
    return { id: s.id, code: s.code, rider: rider?.full_name ?? null, kind, label };
  });

  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <FleetLot bays={bays} />
      <p className="note">Tap filters to see scooters by status.</p>
    </AppShell>
  );
}
