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
  const fullyIds = [...verifiedCount.entries()].filter(([, n]) => n >= DOC_COUNT).map(([id]) => id);
  const fully = fullyIds.length;
  const [{ data: tpl }, { data: sigs }, { data: fullRiders }] = await Promise.all([
    supabase.from("agreement_templates").select("version").order("version", { ascending: false }).limit(1).maybeSingle(),
    fullyIds.length ? supabase.from("rider_agreements").select("rider_id, version").in("rider_id", fullyIds) : Promise.resolve({ data: [] as { rider_id: string; version: number }[] }),
    fullyIds.length ? supabase.from("riders").select("id, full_name, scooters(code)").in("id", fullyIds) : Promise.resolve({ data: [] }),
  ]);
  const current = tpl?.version ?? 1;
  const signedNow = new Set(((sigs ?? []) as { rider_id: string; version: number }[]).filter((s) => s.version >= current).map((s) => s.rider_id));
  const ready = ((fullRiders ?? []) as unknown as { id: string; full_name: string; scooters: { code: string } | null }[])
    .filter((r) => signedNow.has(r.id)).map((r) => ({ riderId: r.id, name: r.full_name, code: r.scooters?.code ?? "–" }));

  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <DocReview riders={[...byRider.values()]} fully={fully} ready={ready} />
    </AppShell>
  );
}
