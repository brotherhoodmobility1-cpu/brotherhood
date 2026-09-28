import { createAdminClient } from "@/lib/supabase/admin";

/** Message types. With Evolution API the full text below is sent; with Meta's API these are template names. */
export const TPL = {
  riderDue: "bm_payment_day",
  riderLate: "bm_payment_late",
  riderReceipt: "bm_payment_received",
  teamList: "bm_team_collection",
  ownerReport: "bm_owner_report",
} as const;

/** Full message text for each type (used with Evolution API). p = the values in order. */
const TEXT: Record<string, (p: string[]) => string> = {
  bm_payment_day: (p) =>
    `Hello ${p[0]},\nThis is Brotherhood Mobility.\nScooter: ${p[1]} · Chassis: ${p[2]}\n\n` +
    `Today is your weekly payment day. Kindly pay your weekly rent of ₹${p[3]} and recharge your wallet using this QR code. ` +
    `After paying, please upload the payment receipt in the Brotherhood Mobility app, or share the screenshot with us here.\n` +
    `Thank you for riding with Brotherhood Mobility!\n\n` +
    `हैलो ${p[4]},\nआज आपके साप्ताहिक भुगतान का दिन है। कृपया इस QR कोड से ₹${p[5]} का साप्ताहिक किराया जमा करें और अपना वॉलेट रिचार्ज करें। ` +
    `भुगतान के बाद ऐप में रसीद अपलोड करें या यहाँ स्क्रीनशॉट भेज दें। धन्यवाद!`,
  bm_payment_late: (p) =>
    `Hello ${p[0]},\nYour Brotherhood Mobility payment for scooter ${p[1]} is late (day ${p[2]} of 2). ₹${p[3]} is pending. ` +
    `Please pay using this QR code and upload the receipt in the app, or share the screenshot here.\nThank you.\n\n` +
    `हैलो ${p[4]},\nस्कूटर ${p[5]} का ₹${p[6]} भुगतान बाकी है। कृपया इस QR कोड से भुगतान करें और ऐप में रसीद अपलोड करें या यहाँ स्क्रीनशॉट भेज दें। धन्यवाद!`,
  bm_payment_received: (p) =>
    `Hello ${p[0]},\nWe have received your payment of ₹${p[1]} for scooter ${p[2]}. Receipt no. ${p[3]}. Your next payment day is ${p[4]}.\n` +
    `Thank you for riding with Brotherhood Mobility!\n\n` +
    `हैलो ${p[5]},\nआपका ₹${p[6]} का भुगतान मिल गया है। रसीद नंबर ${p[7]}। आपका अगला भुगतान ${p[8]} को है। धन्यवाद!`,
  bm_team_collection: (p) =>
    `Good morning ${p[0]}.\nBrotherhood Mobility collection for ${p[1]}: ${p[2]} riders are due today, total ₹${p[3]}.\n\n` +
    `Due today:\n${p[4].split("; ").join("\n")}\n\nLate payments:\n${p[5].split("; ").join("\n")}\n\nPlease follow up and mark payments in the app.`,
  bm_owner_report: (p) =>
    `Good morning ${p[0]}. Brotherhood Mobility report for ${p[1]}.\n` +
    `Collected yesterday: ₹${p[2]}\nCollected last 7 days: ₹${p[3]}\nRent earned last 7 days: ₹${p[4]}\nPending dues: ₹${p[5]}\n` +
    `Fleet in use: ${p[6]}\nOpen breakdowns: ${p[7]}\nSwap plans ending soon: ${p[8]}\nInsurance ending soon: ${p[9]}\nOpen the app for details.`,
};

const evolution = () => !!(process.env.EVOLUTION_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE);
const meta = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
export const waConfigured = () => evolution() || meta();
export const waProvider = () => (evolution() ? "Evolution API" : meta() ? "WhatsApp Business API" : "");
/** Gap between messages with Evolution API, so the number isn't flagged for bulk sending. */
export const pauseBetween = () => (evolution() ? new Promise((r) => setTimeout(r, 4000 + Math.random() * 4000)) : Promise.resolve());

const clean = (s: string) => s.replace(/[\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 900) || "-";

async function sendEvolution(to: string, text: string, imageUrl?: string | null) {
  const base = process.env.EVOLUTION_URL!.replace(/\/+$/, "");
  const inst = encodeURIComponent(process.env.EVOLUTION_INSTANCE!);
  const headers = { apikey: process.env.EVOLUTION_API_KEY!, "Content-Type": "application/json" };
  const number = `91${to}`;
  const res = imageUrl
    ? await fetch(`${base}/message/sendMedia/${inst}`, {
        method: "POST", headers,
        body: JSON.stringify({ number, mediatype: "image", mimetype: "image/jpeg", media: imageUrl, fileName: "brotherhood-payment-qr.jpg", caption: text }),
      })
    : await fetch(`${base}/message/sendText/${inst}`, { method: "POST", headers, body: JSON.stringify({ number, text }) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Evolution API error ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
}

async function sendMeta(to: string, template: string, params: string[], imageUrl?: string | null) {
  const components: object[] = [];
  if (imageUrl) components.push({ type: "header", parameters: [{ type: "image", image: { link: imageUrl } }] });
  components.push({ type: "body", parameters: params.map((p) => ({ type: "text", text: clean(p) })) });
  const v = process.env.WHATSAPP_API_VERSION || "v22.0";
  const res = await fetch(`https://graph.facebook.com/${v}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: `91${to}`, type: "template", template: { name: template, language: { code: "en" }, components } }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as { error?: { message?: string } }).error?.message ?? `WhatsApp error ${res.status}`);
  }
}

export async function sendTemplate(opts: {
  mobile: string; name?: string; template: string; params: string[]; imageUrl?: string | null; forDate?: string | null;
}): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const admin = createAdminClient();
  const to = opts.mobile.replace(/\D/g, "").slice(-10);
  const log = (status: string, error?: string) =>
    admin.from("whatsapp_log").insert({ to_mobile: to, to_name: opts.name ?? null, template: opts.template, for_date: opts.forDate ?? null, status, error: error ?? null });

  if (to.length !== 10) { await log("skipped", "No valid mobile number"); return { ok: false, skipped: true, error: "No valid mobile number" }; }
  if (!waConfigured()) { await log("skipped", "WhatsApp is not connected yet"); return { ok: false, skipped: true, error: "WhatsApp is not connected yet" }; }
  if (opts.forDate) {
    const { count } = await admin.from("whatsapp_log").select("*", { count: "exact", head: true })
      .eq("to_mobile", to).eq("template", opts.template).eq("for_date", opts.forDate).eq("status", "sent");
    if (count) return { ok: true, skipped: true };
  }
  try {
    if (evolution()) {
      const build = TEXT[opts.template];
      if (!build) throw new Error("Unknown message type");
      await sendEvolution(to, build(opts.params), opts.imageUrl);
    } else {
      await sendMeta(to, opts.template, opts.params, opts.imageUrl);
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
