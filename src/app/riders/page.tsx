import AdminHeader from "@/components/admin-header";
import Plate from "@/components/plate";
import { requireTeam } from "@/lib/auth";
import { formatDate, rupees } from "@/lib/format";

type RiderRow = {
  id: string;
  full_name: string;
  mobile: string | null;
  start_date: string | null;
  weekly_rent: number;
  security_deposit: number;
  wallet_balance: number;
  status: string;
  scooters: { code: string } | null;
};

export default async function RidersPage() {
  const { supabase, profile } = await requireTeam();
  const { data, error } = await supabase
    .from("riders")
    .select("id, full_name, mobile, start_date, weekly_rent, security_deposit, wallet_balance, status, scooters(code)")
    .order("scooter_id");
  const riders = (data ?? []) as unknown as RiderRow[];
  const active = riders.filter((r) => r.status === "active").length;

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900">
      <AdminHeader name={profile.full_name} role={profile.role} active="/riders" />
      <section className="p-4 md:p-6">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-bold">Riders</h2>
          <p className="text-sm text-neutral-500">{active} active</p>
        </div>
        {error && <p className="text-red-700 bg-red-50 rounded-lg px-3 py-2 mb-4">Couldn&apos;t load riders: {error.message}</p>}
        <div className="overflow-x-auto bg-white rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500 border-b">
              <tr>
                {["Scooter", "Rider", "Mobile", "Started", "Weekly rent", "Deposit", "Wallet", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {riders.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{r.scooters ? <Plate code={r.scooters.code} /> : "–"}</td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">{r.full_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.mobile ? (
                      <a href={`tel:${r.mobile}`} className="text-green-800 underline">{r.mobile}</a>
                    ) : (
                      <span className="text-red-700 font-semibold">Missing</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.start_date)}</td>
                  <td className="px-4 py-3">{rupees(r.weekly_rent)}</td>
                  <td className="px-4 py-3">{rupees(r.security_deposit)}</td>
                  <td className={`px-4 py-3 font-semibold ${Number(r.wallet_balance) < 0 ? "text-red-700" : ""}`}>
                    {rupees(r.wallet_balance)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-0.5 rounded-full capitalize">{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}