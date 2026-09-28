import { createAdminClient } from "@/lib/supabase/admin";
import { TPL, pauseBetween, qrPublicUrl, sendTemplate, settingOn } from "@/lib/whatsapp";
import { displayDue, formatDate, nextDue, rupees } from "@/lib/format";
import { dayNum, fromDayNum, istDate } from "@/lib/ist";
import { INSURANCE_SOON, SWAP_SOON, daysLeft } from "@/lib/passport";
import { pushToRider } from "@/lib/push";

type Rider = {
  id: string; full_name: string; mobile: string | null; start_date: string | null; weekly_rent: number;
  wallet_balance: number; late_days: number; action_needed: boolean; rent_on_hold: boolean;
  scooters: { code: string; chassis_no: string | null } | null;
};
type Member = { full_name: string; mobile: string; role: string };

const num = (n: number) => Math.round(n).toLocaleString("en-IN");
/** 28-09-2026 */
const dmyFull = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;
const shorten = (s: string, n: number) => (s.length > 600 ? `${s.slice(0, 590)}… and more (${n} in the app)` : s || "none");

/** Everything the morning messages need: who pays today, who is late, and the business figures. */
export async function morningData() {
  const admin = createAdminClient();
  const today = istDate();
  const t = dayNum(today);
  const from7 = fromDayNum(t - 7);
  const [{ data: riderRows }, { data: team }, { data: pays }, { data: charges }, { data: scooters }, { data: jobs }, { data: plans }, { data: allPays }] = await Promise.all([
    admin.from("riders")
      .select("id, full_name, mobile, start_date, weekly_rent, wallet_balance, late_days, action_needed, rent_on_hold, scooters(code, chassis_no)")
      .eq("status", "active").order("scooter_id"),
    admin.from("profiles").select("full_name, mobile, role").in("role", ["owner", "staff"]),
    admin.from("payments").select("amount, paid_at").eq("status", "paid").gte("paid_at", from7 + "T00:00:00+05:30"),
    admin.from("wallet_ledger").select("amount, for_date").eq("kind", "daily_charge").gte("for_date", from7),
    admin.from("scooters").select("id, status, insurance_to").neq("status", "retired"),
    admin.from("jobs").select("id").eq("status", "open"),
    admin.from("swap_plans").select("scooter_id, ends_on").order("starts_on", { ascending: false }),
    admin.from("payments").select("amount").eq("status", "paid"),
  ]);
  const riders = (riderRows ?? []) as unknown as Rider[];
  const members = (team ?? []) as Member[];
  const due = riders.filter((r) => !r.rent_on_hold && nextDue(r.start_date) === today && Number(r.wallet_balance) < Number(r.weekly_rent));
  const late = riders.filter((r) => !r.rent_on_hold && nextDue(r.start_date) !== today && Number(r.wallet_balance) < 0);
  const dueList = due.map((r) => `${r.full_name.toUpperCase()} · ${r.scooters?.code ?? ""} · ${rupees(r.weekly_rent)}`).join("; ");
  const lateList = late.map((r) => `${r.full_name.toUpperCase()} · ${r.scooters?.code ?? ""} · ${rupees(-Number(r.wallet_balance))}`).join("; ");
  const dueTotal = due.reduce((a, r) => a + Number(r.weekly_rent), 0);
  const lateTotal = late.reduce((a, r) => a - Number(r.wallet_balance), 0);

  const P = ((pays ?? []) as { amount: number; paid_at: string }[]).map((p) => ({ d: dayNum(istDate(p.paid_at)), a: Number(p.amount) }));
  const yesterday = P.filter((p) => p.d === t - 1).reduce((a, p) => a + p.a, 0);
  const week = P.filter((p) => p.d >= t - 7 && p.d <= t - 1).reduce((a, p) => a + p.a, 0);
  const earned = ((charges ?? []) as { amount: number; for_date: string }[]).filter((c) => dayNum(c.for_date) <= t - 1).reduce((a, c) => a - Number(c.amount), 0);
  const dues = riders.reduce((a, r) => a + (Number(r.wallet_balance) < 0 ? -Number(r.wallet_balance) : 0), 0);
  const totalCollection = ((allPays ?? []) as { amount: number }[]).reduce((a, p) => a + Number(p.amount), 0);
  const S = (scooters ?? []) as { id: number; status: string; insurance_to: string | null }[];
  const rented = S.filter((s) => s.status === "rented").length;
  const latestEnd = new Map<number, string>();
  ((plans ?? []) as { scooter_id: number; ends_on: string }[]).forEach((p) => { if (!latestEnd.has(p.scooter_id)) latestEnd.set(p.scooter_id, p.ends_on); });
  const swapSoon = [...latestEnd.values()].filter((e) => (daysLeft(e) ?? 99) <= SWAP_SOON).length;
  const insSoon = S.filter((s) => s.insurance_to && (daysLeft(s.insurance_to) ?? 99) <= INSURANCE_SOON).length;

  /** The full Morning Business Report for one owner. */
  const ownerParams = (firstName: string) => [
    firstName, dmyFull(today), num(yesterday), num(week), num(earned), num(dues),
    `${rented} of ${S.length}`, String((jobs ?? []).length), String(swapSoon), String(insSoon),
    String(riders.length), String(S.length), String(S.filter((s) => s.status === "available").length), String(rented),
    String(due.length), num(dueTotal), shorten(dueList, due.length), String(late.length), num(lateTotal), shorten(lateList, late.length),
    num(totalCollection), String(S.filter((s) => s.status === "workshop").length),
  ];
  /** The collection list for one staff member. */
  const teamParams = (firstName: string) => [
    firstName, dmyFull(today), String(due.length), num(dueTotal), shorten(dueList, due.length), shorten(lateList, late.length),
  ];
  return { today, due, late, members, ownerParams, teamParams };
}

/**
 * Sends the morning WhatsApp messages. Safe to run more than once a day: each message goes only once.
 * Owners get ONE message (the full Business Report, which includes the collection list).
 * Staff get the collection list.
 */
export async function runMorning() {
  const [dueOn, lateOn, teamOn, ownerOn] = await Promise.all([
    settingOn("wa_rider_due"), settingOn("wa_rider_late"), settingOn("wa_team_list"), settingOn("wa_owner_report"),
  ]);
  const qr = await qrPublicUrl();
  const d = await morningData();
  const sent = { riderDue: 0, riderLate: 0, team: 0, owner: 0, failed: 0 };
  const count = (ok: boolean, k: keyof typeof sent) => { if (ok) sent[k]++; else sent.failed++; };
  const first = (n: string) => n.split(" ")[0];

  // App notifications (free) go to every due or late rider who allowed them, whatever the WhatsApp switches say.
  for (const r of d.due) {
    await pushToRider(r.id, "due", {
      title: "Today is your payment day",
      body: `Pay your weekly rent of ₹${num(Number(r.weekly_rent))} for ${r.scooters?.code ?? "your scooter"}. Tap to pay. / आज भुगतान का दिन है।`,
      url: "/rider", tag: "payment-day",
    }, d.today);
  }
  for (const r of d.late) {
    await pushToRider(r.id, "late", {
      title: "Payment pending",
      body: `₹${num(-Number(r.wallet_balance))} is pending for ${r.scooters?.code ?? "your scooter"} (day ${Math.min(2, Math.max(1, r.late_days))} of 2). Tap to pay. / भुगतान बाकी है।`,
      url: "/rider", tag: "payment-late",
    }, d.today);
  }
  if (dueOn) for (const r of d.due) {
    if (!r.mobile) continue;
    const amount = num(Number(r.weekly_rent));
    const res = await sendTemplate({
      mobile: r.mobile, name: r.full_name, template: TPL.riderDue, imageUrl: qr, forDate: d.today,
      params: [r.full_name, r.scooters?.code ?? "", r.scooters?.chassis_no ?? "-", amount, r.full_name, amount],
    });
    if (!res.skipped) { count(res.ok, "riderDue"); await pauseBetween(); }
  }
  if (lateOn) for (const r of d.late) {
    if (!r.mobile) continue;
    const pending = num(-Number(r.wallet_balance));
    const res = await sendTemplate({
      mobile: r.mobile, name: r.full_name, template: TPL.riderLate, imageUrl: qr, forDate: d.today,
      params: [r.full_name, r.scooters?.code ?? "", String(Math.min(2, Math.max(1, r.late_days))), pending, r.full_name, r.scooters?.code ?? "", pending],
    });
    if (!res.skipped) { count(res.ok, "riderLate"); await pauseBetween(); }
  }
  if (ownerOn) for (const m of d.members.filter((x) => x.role === "owner")) {
    const res = await sendTemplate({ mobile: m.mobile, name: m.full_name, template: TPL.ownerReport, forDate: d.today, params: d.ownerParams(first(m.full_name)) });
    if (!res.skipped) { count(res.ok, "owner"); await pauseBetween(); }
  }
  // Owners already have the full report; they only get the list if the report is switched off.
  if (teamOn) for (const m of d.members.filter((x) => x.role === "staff" || !ownerOn)) {
    const res = await sendTemplate({ mobile: m.mobile, name: m.full_name, template: TPL.teamList, forDate: d.today, params: d.teamParams(first(m.full_name)) });
    if (!res.skipped) { count(res.ok, "team"); await pauseBetween(); }
  }
  return { date: d.today, due: d.due.length, late: d.late.length, owners: d.members.filter((x) => x.role === "owner").map((m) => m.full_name), sent };
}

/** Sent right after a payment is confirmed or recorded. Never throws. */
export async function notifyPaymentReceived(riderId: string, amount: number, receipt: string) {
  await pushToRider(riderId, "receipt", {
    title: "Payment received ✓",
    body: `₹${num(amount)} received. Receipt ${receipt}. Thank you! / भुगतान मिल गया, धन्यवाद!`,
    url: "/rider", tag: `receipt-${receipt}`,
  });
  try {
    if (!(await settingOn("wa_rider_receipt"))) return;
    const admin = createAdminClient();
    const { data: r } = await admin.from("riders").select("full_name, mobile, start_date, weekly_rent, wallet_balance, scooters(code)").eq("id", riderId).single();
    if (!r?.mobile) return;
    const code = (r as unknown as { scooters: { code: string } | null }).scooters?.code ?? "";
    const next = formatDate(displayDue(r.start_date, r.wallet_balance, r.weekly_rent));
    const amt = num(amount);
    await sendTemplate({
      mobile: r.mobile, name: r.full_name, template: TPL.riderReceipt,
      params: [r.full_name, amt, code, receipt, next, r.full_name, amt, receipt, next],
    });
  } catch { /* never block a payment because of WhatsApp */ }
}
