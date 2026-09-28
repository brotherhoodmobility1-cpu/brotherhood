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
const LINE = "━━━━━━━━━━━━━━━━━━";
const HEAD = "*BROTHERHOOD MOBILITY*";
const bullets = (s: string) => (s && s !== "none" ? s.split("; ").map((x) => `• ${x}`).join("\n") : "• None");
const TEXT: Record<string, (p: string[]) => string> = {
  bm_payment_day: (p) => [
    HEAD, "Payment Day Reminder", LINE,
    `Hello ${p[0]},`, `Scooter : ${p[1]}`, `Chassis : ${p[2]}`, `Weekly Rent : ₹${p[3]}`, LINE,
    "Today is your weekly payment day. Kindly pay your weekly rent and recharge your wallet using this QR code.",
    "After paying, please upload the payment receipt in the Brotherhood Mobility app, or share the screenshot with us here.", LINE,
    `हैलो ${p[4]},`, `आज आपके साप्ताहिक भुगतान का दिन है। कृपया इस QR कोड से ₹${p[5]} का साप्ताहिक किराया जमा करें और अपना वॉलेट रिचार्ज करें।`,
    "भुगतान के बाद ऐप में रसीद अपलोड करें या यहाँ स्क्रीनशॉट भेज दें।", LINE,
    "Thank you for riding with us", HEAD,
  ].join("\n"),
  bm_payment_late: (p) => [
    HEAD, "Payment Pending", LINE,
    `Hello ${p[0]},`, `Scooter : ${p[1]}`, `Pending Amount : ₹${p[3]}`, `Late : Day ${p[2]} of 2`, LINE,
    "Your payment is late. Please pay using this QR code and upload the receipt in the app, or share the screenshot here.", LINE,
    `हैलो ${p[4]},`, `स्कूटर ${p[5]} का ₹${p[6]} भुगतान बाकी है। कृपया इस QR कोड से भुगतान करें और ऐप में रसीद अपलोड करें या यहाँ स्क्रीनशॉट भेज दें।`, LINE,
    "Thank you", HEAD,
  ].join("\n"),
  bm_payment_received: (p) => [
    HEAD, "Payment Received", LINE,
    `Hello ${p[0]},`, `Amount : ₹${p[1]}`, `Scooter : ${p[2]}`, `Receipt No. : ${p[3]}`, `Next Payment Day : ${p[4]}`, LINE,
    "We have received your payment. Thank you!", LINE,
    `हैलो ${p[5]},`, `आपका ₹${p[6]} का भुगतान मिल गया है। रसीद नंबर ${p[7]}। आपका अगला भुगतान ${p[8]} को है। धन्यवाद!`, LINE,
    "Thank you for riding with us", HEAD,
  ].join("\n"),
  bm_team_collection: (p) => [
    HEAD, "📋 Today's Collection List", `📅 Date : ${p[1]}`, LINE,
    `Good morning ${p[0]}`, LINE,
    `📌 Collect Today : ${p[2]} riders · ₹${p[3]}`, bullets(p[4]), LINE,
    "⏰ Late Payments", bullets(p[5]), LINE,
    "Please follow up and mark payments in the app.", "Have a Great Day", HEAD,
  ].join("\n"),
  bm_owner_report: (p) => [
    HEAD, "📊 Morning Business Report", `📅 Date : ${p[1]}`, LINE,
    `👥 Active Riders : ${p[10] ?? "-"}`, `🛵 Total Fleet : ${p[11] ?? "-"}`, `✅ Available Scooters : ${p[12] ?? "-"}`,
    `🚦 Rented Scooters : ${p[13] ?? "-"}`, `🔧 With Mechanic : ${p[21] ?? "-"}`, LINE,
    `💰 Collected Yesterday : ₹${p[2]}`, `📈 Collected Last 7 Days : ₹${p[3]}`, `🧾 Rent Earned (7 days) : ₹${p[4]}`,
    `💼 Total Collection : ₹${p[20] ?? "-"}`, `⚠️ Pending Dues : ₹${p[5]}`, LINE,
    `📌 Collect Today : ${p[14] ?? "0"} riders · ₹${p[15] ?? "0"}`, bullets(p[16] ?? ""), LINE,
    `⏰ Late Payments : ${p[17] ?? "0"} riders · ₹${p[18] ?? "0"}`, bullets(p[19] ?? ""), LINE,
    `🛠 Open Breakdowns : ${p[7]}`, `🔋 Swap Plans Ending : ${p[8]}`, `🛡 Insurance Ending : ${p[9]}`, LINE,
    "Have a Great Day", HEAD,
  ].join("\n"),
};

/** How many values each Meta template expects (extra values are only used in the Evolution text). */
const META_COUNT: Record<string, number> = { bm_payment_day: 6, bm_payment_late: 7, bm_payment_received: 9, bm_team_collection: 6, bm_owner_report: 10 };

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
  components.push({ type: "body", parameters: params.slice(0, META_COUNT[template] ?? params.length).map((p) => ({ type: "text", text: clean(p) })) });
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
