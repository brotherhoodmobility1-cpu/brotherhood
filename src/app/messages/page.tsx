import AppShell from "@/components/app-shell";
import MessagesManager, { type LogRow } from "@/components/messages-manager";
import { requireTeam } from "@/lib/auth";
import { waConfigured, waProvider } from "@/lib/whatsapp";

// "Send today's morning messages now" sends messages a few seconds apart, so allow it time to finish.
export const maxDuration = 300;

export default async function MessagesPage() {
  const { supabase, profile } = await requireTeam(["owner"]);
  const [{ data: settings }, { data: log }] = await Promise.all([
    supabase.from("app_settings").select("key, value").like("key", "wa_%"),
    supabase.from("whatsapp_log").select("id, to_mobile, to_name, template, status, error, created_at").order("created_at", { ascending: false }).limit(60),
  ]);
  const on = Object.fromEntries(((settings ?? []) as { key: string; value: string }[]).map((s) => [s.key, s.value === "on"]));
  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <MessagesManager configured={waConfigured()} provider={waProvider()} cron={!!process.env.CRON_SECRET} on={on} log={(log ?? []) as LogRow[]} />
    </AppShell>
  );
}
