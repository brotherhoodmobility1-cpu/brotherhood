import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

export const pushConfigured = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let ready = false;
function setup() {
  if (ready || !pushConfigured()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:brotherhood1@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  ready = true;
}

async function pushOn() {
  const { data } = await createAdminClient().from("app_settings").select("value").eq("key", "push_on").maybeSingle();
  return data?.value !== "off";
}

/** Sends a notification to every phone of one login. kind is used for the log and to avoid repeats on the same day. */
export async function pushToProfile(profileId: string, name: string, kind: string, msg: PushMessage, forDate?: string | null) {
  try {
    if (!pushConfigured() || !(await pushOn())) return;
    setup();
    const admin = createAdminClient();
    const template = `push_${kind}`;
    if (forDate) {
      const { count } = await admin.from("whatsapp_log").select("*", { count: "exact", head: true })
        .eq("to_mobile", `app:${profileId.slice(0, 8)}`).eq("template", template).eq("for_date", forDate).eq("status", "sent");
      if (count) return;
    }
    const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("profile_id", profileId);
    const list = (subs ?? []) as { id: number; endpoint: string; p256dh: string; auth: string }[];
    const log = (status: string, error?: string) => admin.from("whatsapp_log").insert({
      to_mobile: `app:${profileId.slice(0, 8)}`, to_name: name, template, for_date: forDate ?? null, status, error: error ?? null,
    });
    if (!list.length) { await log("skipped", "Notifications not turned on for this phone"); return; }
    let sent = 0, lastErr = "";
    for (const s of list) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 60 * 60 * 12 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id); // phone unsubscribed
        lastErr = e instanceof Error ? e.message : "Push failed";
      }
    }
    await log(sent ? "sent" : "failed", sent ? undefined : lastErr);
  } catch { /* never block the app because of a notification */ }
}

/** Sends to the login linked to a rider. */
export async function pushToRider(riderId: string, kind: string, msg: PushMessage, forDate?: string | null) {
  try {
    const { data: r } = await createAdminClient().from("riders").select("profile_id, full_name").eq("id", riderId).single();
    if (r?.profile_id) await pushToProfile(r.profile_id, r.full_name, kind, msg, forDate);
  } catch { /* ignore */ }
}
