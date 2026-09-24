import AdminHeader from "@/components/admin-header";
import Plate from "@/components/plate";
import { requireTeam } from "@/lib/auth";

type ScooterRow = {
  id: number;
  code: string;
  chassis_no: string | null;
  status: string;
  riders: { full_name: string; status: string }[];
};

const statusStyle: Record<string, string> = {
  rented: "bg-green-100 text-green-800",
  available: "bg-neutral-200 text-neutral-700",
  workshop: "bg-blue-100 text-blue-800",
};

export default async function ScootersPage() {
  const { supabase, profile } = await requireTeam();
  const { data, error } = await supabase
    .from("scooters")
    .select("id, code, chassis_no, status, riders(full_name, status)")
    .order("id");
  const scooters = (data ?? []) as unknown as ScooterRow[];
  const count = (s: string) => scooters.filter((x) => x.status === s).length;

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900">
      <AdminHeader name={profile.full_name} role={profile.role} active="/scooters" />
      <section className="p-4 md:p-6">
        <h2 className="text-xl font-bold mb-3">Scooters</h2>
        <p className="text-sm text-neutral-600 mb-4">
          {scooters.length} total · {count("rented")} rented · {count("available")} available · {count("workshop")} with mechanic
        </p>
        {error && <p className="text-red-700 bg-red-50 rounded-lg px-3 py-2 mb-4">Couldn&apos;t load scooters: {error.message}</p>}
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
          {scooters.map((s) => {
            const rider = s.riders.find((r) => r.status === "active");
            return (
              <div key={s.id} className="bg-white rounded-2xl border p-4">
                <Plate code={s.code} />
                <p className="text-xs text-neutral-500 mt-2">Chassis {s.chassis_no ?? "–"}</p>
                <p className="font-semibold mt-1 truncate">{rider ? rider.full_name : "No rider"}</p>
                <span className={`inline-block mt-2 text-xs font-bold px-2.5 py-0.5 rounded-full capitalize ${statusStyle[s.status] ?? ""}`}>
                  {s.status}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}