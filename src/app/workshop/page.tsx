import AppShell from "@/components/app-shell";
import WorkshopBoard from "@/components/workshop-board";
import { requireTeam } from "@/lib/auth";
import { JOB_SELECT, type Job } from "@/lib/jobs";

export default async function WorkshopPage() {
  const { supabase, profile } = await requireTeam(["owner", "staff", "mechanic"]);
  const [{ data: open }, { data: done }] = await Promise.all([
    supabase.from("jobs").select(JOB_SELECT).eq("status", "open").order("created_at"),
    supabase.from("jobs").select(JOB_SELECT).eq("status", "done").order("closed_at", { ascending: false }).limit(20),
  ]);
  const openJobs = (open ?? []) as unknown as Job[];
  const paths = openJobs.flatMap((j) => j.photos);
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("job-photos").createSignedUrls(paths, 3600);
    (signed ?? []).forEach((s) => { if (s.path && s.signedUrl) urls[s.path] = s.signedUrl; });
  }
  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <WorkshopBoard jobs={openJobs} done={(done ?? []) as unknown as Job[]} urls={urls} />
    </AppShell>
  );
}
