import AppShell from "@/components/app-shell";
import MessagesManager, { type LogRow } from "@/components/messages-manager";
import { requireTeam } from "@/lib/auth";
import { waConfigured, waProvider } from "@/lib/whatsapp";
import { fromDayNum, dayNum, istDate } from "@/lib/ist";

// "Send today's morning messages now" sends messages a few seconds apart, so allow it time to finish.
export const maxDuration = 300;

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, profile } = await requireTeam(["owner"]);
  const sp = await searchParams;
  const today = istDate();
  const day = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const next = fromDayNum(dayNum(day) + 1);
  const [{ data: settings }, { data: log }] = await Promise.all([
    supabase.from("app_settings").select("key, value").or("key.like.wa_%,key.eq.push_on"),
    supabase.from("whatsapp_log").select("id, to_mobile, to_name, template, status, error, created_at")
      .gte("created_at", `${day}T00:00:00+05:30`).lt("created_at", `${next}T00:00:00+05:30`)
      .order("created_at", { ascending: false }).limit(1000),
  ]);
  const on = Object.fromEntries(((settings ?? []) as { key: string; value: string }[]).map((s) => [s.key, s.value === "on"]));
  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <MessagesManager configured={waConfigured()} provider={waProvider()} cron={!!process.env.CRON_SECRET} on={on} log={(log ?? []) as LogRow[]} day={day} today={today} />
    </AppShell>
  );
}
