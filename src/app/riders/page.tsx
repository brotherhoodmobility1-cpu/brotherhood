import AppShell from "@/components/app-shell";
import Plate from "@/components/plate";
import { requireTeam } from "@/lib/auth";
import { formatDate, perDay, rupees } from "@/lib/format";
import { riderTag } from "@/lib/status";

type RiderRow = {
  id: string;
  full_name: string;
  mobile: string | null;
  start_date: string | null;
  weekly_rent: number;
  security_deposit: number;
  wallet_balance: number;
  action_needed: boolean;
  status: string;
  scooters: { code: string } | null;
};

export default async function RidersPage() {
  const { supabase, profile } = await requireTeam();
  const { data, error } = await supabase
    .from("riders")
    .select("id, full_name, mobile, start_date, weekly_rent, security_deposit, wallet_balance, action_needed, status, scooters(code)")
    .eq("status", "active")
    .order("scooter_id");
  const riders = (data ?? []) as unknown as RiderRow[];

  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <h2>Active riders ({riders.length})</h2>
      {error && <p className="lerr">Couldn&apos;t load riders: {error.message}</p>}
      {riders.map((r) => {
        const t = riderTag(r);
        return (
          <div className="row" key={r.id}>
            <div className="m">
              <b>{r.full_name} · {r.scooters ? <Plate code={r.scooters.code} /> : "–"}</b>
              <small>
                Started {formatDate(r.start_date)} · {rupees(perDay(r.weekly_rent))}/day · wallet {rupees(r.wallet_balance)} · deposit {rupees(r.security_deposit)}
                {r.mobile ? ` · ${r.mobile}` : " · mobile missing"}
              </small>
            </div>
            <span className={`tag ${t[0]}`}>{t[1]}</span>
            {r.mobile && <a className="tag" href={`tel:${r.mobile}`}>Call</a>}
          </div>
        );
      })}
      <p className="note">Daily charge is weekly rent ÷ 7. Wallets start at ₹0 until payments are connected.</p>
    </AppShell>
  );
}
