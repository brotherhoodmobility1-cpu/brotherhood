import { createAdminClient } from "@/lib/supabase/admin";
import { TPL, pauseBetween, qrPublicUrl, sendTemplate, settingOn } from "@/lib/whatsapp";
import { displayDue, formatDate, nextDue, rupees } from "@/lib/format";
import { dayNum, fromDayNum, istDate } from "@/lib/ist";
import { INSURANCE_SOON, SWAP_SOON, daysLeft } from "@/lib/passport";

type Rider = {
  id: string; full_name: string; mobile: string | null; start_date: string | null; weekly_rent: number;
  wallet_balance: number; late_days: number; action_needed: boolean; rent_on_hold: boolean;
  scooters: { code: string; chassis_no: string | null } | null;
};

const num = (n: number) => Math.round(n).toLocaleString("en-IN");

/** Sends the morning WhatsApp messages. Safe to run more than once a day: each message goes only once. */
export async function runMorning() {
  const admin = createAdminClient();
  const today = istDate();
  const t = dayNum(today);
  const [dueOn, lateOn, teamOn, ownerOn] = await Promise.all([
    settingOn("wa_rider_due"), settingOn("wa_rider_late"), settingOn("wa_team_list"), settingOn("wa_owner_report"),
  ]);
  const qr = await qrPublicUrl();
  const { data } = await admin.from("riders")
    .select("id, full_name, mobile, start_date, weekly_rent, wallet_balance, late_days, action_needed, rent_on_hold, scooters(code, chassis_no)")
    .eq("status", "active").order("scooter_id");
  const riders = (data ?? []) as unknown as Rider[];
  const due = riders.filter((r) => !r.rent_on_hold && nextDue(r.start_date) === today && Number(r.wallet_balance) < Number(r.weekly_rent));
  const late = riders.filter((r) => !r.rent_on_hold && nextDue(r.start_date) !== today && Number(r.wallet_balance) < 0);
  const sent = { riderDue: 0, riderLate: 0, team: 0, owner: 0, failed: 0 };
  const count = (ok: boolean, k: keyof typeof sent) => { if (ok) sent[k]++; else sent.failed++; };

  if (dueOn) for (const r of due) {
    if (!r.mobile) continue;
    const amount = num(Number(r.weekly_rent));
    const res = await sendTemplate({
      mobile: r.mobile, name: r.full_name, template: TPL.riderDue, imageUrl: qr, forDate: today,
      params: [r.full_name, r.scooters?.code ?? "", r.scooters?.chassis_no ?? "-", amount, r.full_name, amount],
    });
    if (!res.skipped) { count(res.ok, "riderDue"); await pauseBetween(); }
  }
  if (lateOn) for (const r of late) {
    if (!r.mobile) continue;
    const pending = num(-Number(r.wallet_balance));
    const res = await sendTemplate({
      mobile: r.mobile, name: r.full_name, template: TPL.riderLate, imageUrl: qr, forDate: today,
      params: [r.full_name, r.scooters?.code ?? "", String(Math.min(2, Math.max(1, r.late_days))), pending, r.full_name, r.scooters?.code ?? "", pending],
    });
    if (!res.skipped) { count(res.ok, "riderLate"); await pauseBetween(); }
  }

  if (teamOn || ownerOn) {
    const { data: team } = await admin.from("profiles").select("full_name, mobile, role").in("role", ["owner", "staff"]);
    const members = (team ?? []) as { full_name: string; mobile: string; role: string }[];
    const dueList = due.map((r) => `${r.full_name} ${r.scooters?.code ?? ""} ${rupees(r.weekly_rent)}`).join("; ");
    const lateList = late.map((r) => `${r.full_name} ${r.scooters?.code ?? ""} ${rupees(-Number(r.wallet_balance))}`).join("; ");
    const shorten = (s: string, n: number) => (s.length > 600 ? `${s.slice(0, 590)}… and more (${n} in the app)` : s || "none");
    const dueTotal = due.reduce((a, r) => a + Number(r.weekly_rent), 0);

    if (teamOn) for (const m of members) {
      const res = await sendTemplate({
        mobile: m.mobile, name: m.full_name, template: TPL.teamList, forDate: today,
        params: [m.full_name.split(" ")[0], formatDate(today), String(due.length), num(dueTotal), shorten(dueList, due.length), shorten(lateList, late.length)],
      });
      if (!res.skipped) { count(res.ok, "team"); await pauseBetween(); }
    }

    if (ownerOn) {
      const from7 = fromDayNum(t - 7);
      const [{ data: pays }, { data: charges }, { data: scooters }, { data: jobs }, { data: plans }] = await Promise.all([
        admin.from("payments").select("amount, paid_at").eq("status", "paid").gte("paid_at", from7 + "T00:00:00+05:30"),
        admin.from("wallet_ledger").select("amount, for_date").eq("kind", "daily_charge").gte("for_date", from7),
        admin.from("scooters").select("id, status, insurance_to").neq("status", "retired"),
        admin.from("jobs").select("id").eq("status", "open"),
        admin.from("swap_plans").select("scooter_id, ends_on").order("starts_on", { ascending: false }),
      ]);
      const P = ((pays ?? []) as { amount: number; paid_at: string }[]).map((p) => ({ d: dayNum(istDate(p.paid_at)), a: Number(p.amount) }));
      const yesterday = P.filter((p) => p.d === t - 1).reduce((a, p) => a + p.a, 0);
      const week = P.filter((p) => p.d >= t - 7 && p.d <= t - 1).reduce((a, p) => a + p.a, 0);
      const earned = ((charges ?? []) as { amount: number; for_date: string }[]).filter((c) => dayNum(c.for_date) <= t - 1).reduce((a, c) => a - Number(c.amount), 0);
      const dues = riders.reduce((a, r) => a + (Number(r.wallet_balance) < 0 ? -Number(r.wallet_balance) : 0), 0);
      const S = (scooters ?? []) as { id: number; status: string; insurance_to: string | null }[];
      const rented = S.filter((s) => s.status === "rented").length;
      const latestEnd = new Map<number, string>();
      ((plans ?? []) as { scooter_id: number; ends_on: string }[]).forEach((p) => { if (!latestEnd.has(p.scooter_id)) latestEnd.set(p.scooter_id, p.ends_on); });
      const swapSoon = [...latestEnd.values()].filter((e) => (daysLeft(e) ?? 99) <= SWAP_SOON).length;
      const insSoon = S.filter((s) => s.insurance_to && (daysLeft(s.insurance_to) ?? 99) <= INSURANCE_SOON).length;
      for (const m of members.filter((x) => x.role === "owner")) {
        const res = await sendTemplate({
          mobile: m.mobile, name: m.full_name, template: TPL.ownerReport, forDate: today,
          params: [m.full_name.split(" ")[0], formatDate(today), num(yesterday), num(week), num(earned), num(dues),
            `${rented} of ${S.length}`, String((jobs ?? []).length), String(swapSoon), String(insSoon)],
        });
        if (!res.skipped) { count(res.ok, "owner"); await pauseBetween(); }
      }
    }
  }
  return { date: today, due: due.length, late: late.length, sent };
}

/** Sent right after a payment is confirmed or recorded. Never throws. */
export async function notifyPaymentReceived(riderId: string, amount: number, receipt: string) {
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
