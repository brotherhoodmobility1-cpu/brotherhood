import AppShell from "@/components/app-shell";
import DocReview, { type PendingRider } from "@/components/doc-review";
import { requireTeam } from "@/lib/auth";
import { DOC_COUNT } from "@/lib/docs";

type Row = {
  id: number;
  kind: string;
  status: string;
  path: string | null;
  rider_id: string;
  riders: { full_name: string; scooters: { code: string } | null } | null;
};

export default async function DocumentsPage() {
  const { supabase, profile } = await requireTeam();
  const { data } = await supabase.from("documents").select("id, kind, status, path, rider_id, riders(full_name, scooters(code))");
  const rows = (data ?? []) as unknown as Row[];

  const pending = rows.filter((r) => r.status === "uploaded" && r.path);
  const urls: Record<string, string> = {};
  if (pending.length) {
    const { data: signed } = await supabase.storage.from("rider-docs").createSignedUrls(pending.map((p) => p.path!), 3600);
    (signed ?? []).forEach((s) => { if (s.path && s.signedUrl) urls[s.path] = s.signedUrl; });
  }

  const byRider = new Map<string, PendingRider>();
  for (const r of pending) {
    const g = byRider.get(r.rider_id) ?? { riderId: r.rider_id, name: r.riders?.full_name ?? "Rider", code: r.riders?.scooters?.code ?? "–", docs: [] };
    g.docs.push({ id: r.id, kind: r.kind, url: urls[r.path!] ?? "" });
    byRider.set(r.rider_id, g);
  }
  const verifiedCount = new Map<string, number>();
  rows.filter((r) => r.status === "verified").forEach((r) => verifiedCount.set(r.rider_id, (verifiedCount.get(r.rider_id) ?? 0) + 1));
  const fully = [...verifiedCount.values()].filter((n) => n >= DOC_COUNT).length;

  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <DocReview riders={[...byRider.values()]} fully={fully} />
    </AppShell>
  );
}
