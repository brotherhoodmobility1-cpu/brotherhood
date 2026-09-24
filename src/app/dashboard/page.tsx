import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, must_change_password")
    .eq("id", user.id)
    .single();
  if (profile?.must_change_password) redirect("/change-password");

  const { count } = await supabase
    .from("scooters")
    .select("*", { count: "exact", head: true });

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="bg-black text-white px-6 py-5 border-b-4 border-yellow-400 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold italic tracking-wide">BROTHERHOOD MOBILITY</h1>
          <p className="text-sm text-neutral-400">Signed in as {profile?.full_name ?? "unknown"} ({profile?.role ?? "no role"})</p>
        </div>
        <LogoutButton />
      </header>
      <section className="p-6">
        <div className="bg-white rounded-2xl border p-6 max-w-sm">
          <p className="text-sm text-neutral-500">Scooters in your fleet</p>
          <p className="text-4xl font-bold">{count ?? 0}</p>
        </div>
      </section>
    </main>
  );
}