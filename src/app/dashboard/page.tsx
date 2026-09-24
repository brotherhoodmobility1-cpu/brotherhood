import AdminHeader from "@/components/admin-header";
import { requireTeam } from "@/lib/auth";

export default async function DashboardPage() {
  const { supabase, profile } = await requireTeam();
  const head = { count: "exact" as const, head: true };
  const [total, rented, available, riders] = await Promise.all([
    supabase.from("scooters").select("*", head),
    supabase.from("scooters").select("*", head).eq("status", "rented"),
    supabase.from("scooters").select("*", head).eq("status", "available"),
    supabase.from("riders").select("*", head).eq("status", "active"),
  ]);
  const cards = [
    { label: "Scooters in your fleet", value: total.count ?? 0 },
    { label: "Rented out", value: rented.count ?? 0 },
    { label: "Available to allot", value: available.count ?? 0 },
    { label: "Active riders", value: riders.count ?? 0 },
  ];

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900">
      <AdminHeader name={profile.full_name} role={profile.role} active="/dashboard" />
      <section className="p-4 md:p-6 grid gap-3 grid-cols-2 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border p-5">
            <p className="text-sm text-neutral-500">{c.label}</p>
            <p className="text-4xl font-bold">{c.value}</p>
          </div>
        ))}
      </section>
    </main>
  );
}