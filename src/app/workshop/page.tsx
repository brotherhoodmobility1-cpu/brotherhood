import AppShell from "@/components/app-shell";
import WorkshopBoard from "@/components/workshop-board";
import { requireTeam } from "@/lib/auth";
import { JOB_SELECT, type Job } from "@/lib/jobs";
import type { StockItem } from "@/lib/parts";

export default async function WorkshopPage() {
  const { supabase, profile } = await requireTeam(["owner", "staff", "mechanic"]);
  const [{ data: open }, { data: done }, { data: stock }] = await Promise.all([
    supabase.from("jobs").select(JOB_SELECT).eq("status", "open").order("created_at"),
    supabase.from("jobs").select(JOB_SELECT).eq("status", "done").order("closed_at", { ascending: false }).limit(20),
    supabase.from("parts_inventory").select("id, name, barcode, unit_price, quantity, min_stock").eq("active", true).order("name"),
  ]);
  const openJobs = (open ?? []) as unknown as Job[];
  const paths = openJobs.flatMap((j) => [...j.photos, ...j.job_parts.map((p) => p.photo_path).filter((x): x is string => !!x)]);
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("job-photos").createSignedUrls(paths, 3600);
    (signed ?? []).forEach((s) => { if (s.path && s.signedUrl) urls[s.path] = s.signedUrl; });
  }
  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <WorkshopBoard jobs={openJobs} done={(done ?? []) as unknown as Job[]} urls={urls} stock={(stock ?? []) as StockItem[]} />
    </AppShell>
  );
}
