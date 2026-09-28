"use server";

import { getMe } from "@/lib/me";

export async function saveSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string) {
  const me = await getMe();
  if (!me) return { ok: false };
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };
  const { error } = await me.supabase.from("push_subscriptions").upsert(
    { profile_id: me.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent.slice(0, 200) },
    { onConflict: "endpoint" },
  );
  return { ok: !error };
}
