import AppShell from "@/components/app-shell";
import Plate from "@/components/plate";
import { requireTeam } from "@/lib/auth";
import { scooterStatus } from "@/lib/status";
import MarkAvailable from "@/components/mark-available";

type Row = {
  id: number;
  code: string;
  chassis_no: string | null;
  motor_no: string | null;
  status: string;
  riders: { full_name: string; status: string; wallet_balance: number; action_needed: boolean }[];
};

const TAG: Record<string, string> = { ok: "", warn: "due", bad: "bad", mech: "due", free: "" };

export default async function ScootersPage() {
  const { supabase, profile } = await requireTeam();
  const { data } = await supabase
    .from("scooters")
    .select("id, code, chassis_no, motor_no, status, riders(full_name, status, wallet_balance, action_needed)")
    .order("id");
  const rows = (data ?? []) as unknown as Row[];

  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <h2>Fleet ({rows.length})</h2>
      {rows.map((s) => {
        const rider = s.riders.find((r) => r.status === "active") ?? null;
        const [kind, label] = scooterStatus(s.status, rider);
        return (
          <div className="row" key={s.id}>
            <div className="m">
              <b><Plate code={s.code} /></b>
              <small>
                Chassis {s.chassis_no ?? "–"}
                {s.motor_no ? ` · Motor ${s.motor_no}` : ""} · {rider ? `with ${rider.full_name}` : "not allocated"}
              </small>
            </div>
            <span className={`tag ${TAG[kind] ?? ""}`}>{label}</span>
            {kind === "mech" && <MarkAvailable id={s.id} />}
          </div>
        );
      })}
    </AppShell>
  );
}
