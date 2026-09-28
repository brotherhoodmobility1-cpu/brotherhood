import { createAdminClient } from "@/lib/supabase/admin";

/** Template names. Create these in WhatsApp Manager exactly as in the setup guide. */
export const TPL = {
  riderDue: "bm_payment_day",
  riderLate: "bm_payment_late",
  riderReceipt: "bm_payment_received",
  teamList: "bm_team_collection",
  ownerReport: "bm_owner_report",
} as const;

export const waConfigured = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);

/** WhatsApp template variables can't contain line breaks or long runs of spaces. */
const clean = (s: string) => s.replace(/[\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 900) || "-";

export async function sendTemplate(opts: {
  mobile: string; name?: string; template: string; params: string[]; imageUrl?: string | null; forDate?: string | null;
}): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const admin = createAdminClient();
  const to = opts.mobile.replace(/\D/g, "").slice(-10);
  const log = (status: string, error?: string) =>
    admin.from("whatsapp_log").insert({ to_mobile: to, to_name: opts.name ?? null, template: opts.template, for_date: opts.forDate ?? null, status, error: error ?? null });

  if (to.length !== 10) { await log("skipped", "No valid mobile number"); return { ok: false, skipped: true, error: "No valid mobile number" }; }
  if (!waConfigured()) { await log("skipped", "WhatsApp is not set up yet"); return { ok: false, skipped: true, error: "WhatsApp is not set up yet" }; }
  if (opts.forDate) {
    const { count } = await admin.from("whatsapp_log").select("*", { count: "exact", head: true })
      .eq("to_mobile", to).eq("template", opts.template).eq("for_date", opts.forDate).eq("status", "sent");
    if (count) return { ok: true, skipped: true };
  }

  const components: object[] = [];
  if (opts.imageUrl) components.push({ type: "header", parameters: [{ type: "image", image: { link: opts.imageUrl } }] });
  components.push({ type: "body", parameters: opts.params.map((p) => ({ type: "text", text: clean(p) })) });

  try {
    const v = process.env.WHATSAPP_API_VERSION || "v22.0";
    const res = await fetch(`https://graph.facebook.com/${v}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: `91${to}`, type: "template",
        template: { name: opts.template, language: { code: "en" }, components },
      }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      const msg = (e as { error?: { message?: string } }).error?.message ?? `WhatsApp error ${res.status}`;
      await log("failed", msg);
      return { ok: false, error: msg };
    }
    await log("sent");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    await log("failed", msg);
    return { ok: false, error: msg };
  }
}

export async function settingOn(key: string) {
  const { data } = await createAdminClient().from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value === "on";
}

export async function qrPublicUrl() {
  const admin = createAdminClient();
  const { data } = await admin.from("app_settings").select("value").eq("key", "qr_version").maybeSingle();
  if (!data?.value) return null;
  return `${admin.storage.from("brand").getPublicUrl("payment-qr.jpg").data.publicUrl}?v=${data.value}`;
}
