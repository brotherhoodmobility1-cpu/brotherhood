import AppShell from "@/components/app-shell";
import Plate from "@/components/plate";
import Empty from "@/components/empty";
import WhatsAppButton from "@/components/whatsapp-button";
import { requireTeam } from "@/lib/auth";
import { formatDate, nextDue, rupees } from "@/lib/format";
import { istDate } from "@/lib/ist";

type Rider = {
  id: string; full_name: string; mobile: string | null; start_date: string | null; weekly_rent: number; wallet_balance: number;
  action_needed: boolean; rent_on_hold: boolean; late_days: number; scooters: { code: string; chassis_no: string | null } | null;
};

export default async function TodayPage() {
  const { supabase, profile } = await requireTeam();
  const today = istDate();
  const [{ data: rows }, { data: claims }, { data: paidToday }, { data: settings }] = await Promise.all([
    supabase.from("riders")
      .select("id, full_name, mobile, start_date, weekly_rent, wallet_balance, action_needed, rent_on_hold, late_days, scooters(code, chassis_no)")
      .eq("status", "active").order("scooter_id"),
    supabase.from("payment_claims").select("rider_id, amount").eq("status", "pending"),
    supabase.from("payments").select("rider_id, amount").eq("status", "paid").gte("paid_at", today + "T00:00:00+05:30"),
    supabase.from("app_settings").select("key, value").in("key", ["upi_id", "qr_version"]),
  ]);
  const set = Object.fromEntries(((settings ?? []) as { key: string; value: string }[]).map((s) => [s.key, s.value]));
  const qrUrl = set.qr_version ? `${supabase.storage.from("brand").getPublicUrl("payment-qr.jpg").data.publicUrl}?v=${set.qr_version}` : null;
  const upiId = set.upi_id ?? "";

  const riders = (rows ?? []) as unknown as Rider[];
  const waiting = new Map<string, number>();
  ((claims ?? []) as { rider_id: string; amount: number }[]).forEach((c) => waiting.set(c.rider_id, (waiting.get(c.rider_id) ?? 0) + Number(c.amount)));
  const paid = new Map<string, number>();
  ((paidToday ?? []) as { rider_id: string; amount: number }[]).forEach((p) => paid.set(p.rider_id, (paid.get(p.rider_id) ?? 0) + Number(p.amount)));

  const dueToday = riders.filter((r) => nextDue(r.start_date) === today);
  const late = riders.filter((r) => nextDue(r.start_date) !== today && Number(r.wallet_balance) < 0);
  const status = (r: Rider): [string, string] => {
    if (paid.get(r.id)) return ["", `Paid today ${rupees(paid.get(r.id)!)}`];
    if (waiting.get(r.id)) return ["due", `Receipt sent ${rupees(waiting.get(r.id)!)} · confirm in Payments`];
    if (Number(r.wallet_balance) >= Number(r.weekly_rent)) return ["", "Already covered"];
    return ["bad", "Not paid yet"];
  };
  const notPaid = dueToday.filter((r) => status(r)[0] === "bad").length;

  const Row = ({ r, kind }: { r: Rider; kind: "due" | "reminder" }) => {
    const s = status(r);
    return (
      <div className="row">
        <div className="m">
          <b>{r.full_name} · {r.scooters && <Plate code={r.scooters.code} />}</b>
          <small>
            Chassis {r.scooters?.chassis_no ?? "–"} · {r.mobile ?? "mobile missing"} · weekly rent {rupees(r.weekly_rent)} · wallet {rupees(r.wallet_balance)}
            {kind === "reminder" ? ` · ${r.action_needed ? "2 days unpaid" : `late day ${r.late_days} of 2`}` : ""}
            {r.rent_on_hold ? " · rent on hold" : ""}
          </small>
        </div>
        <span className={`tag ${s[0]}`}>{s[1]}</span>
        {r.mobile && <a className="tag" href={`tel:${r.mobile}`}>Call</a>}
        <WhatsAppButton kind={kind} qrUrl={qrUrl} upiId={upiId}
          r={{ name: r.full_name, mobile: r.mobile, code: r.scooters?.code ?? "", chassis: r.scooters?.chassis_no, weeklyRent: r.weekly_rent, wallet: r.wallet_balance, startDate: r.start_date }} />
      </div>
    );
  };

  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <h2>Payment due today · {formatDate(today)} ({dueToday.length})</h2>
      <p className="mute">{dueToday.length ? `${notPaid} not paid yet · ${dueToday.length - notPaid} paid, sent a receipt or already covered` : ""}</p>
      {dueToday.length === 0 ? <Empty text="Nobody's weekly payment falls on today." /> : dueToday.map((r) => <Row key={r.id} r={r} kind="due" />)}

      <h2>Payment pending from earlier ({late.length})</h2>
      {late.length === 0 ? <p className="mute">Nobody is late.</p> : late.map((r) => <Row key={r.id} r={r} kind="reminder" />)}
      <p className="note">WhatsApp opens the chat with a polite English and Hindi message, the amount and your QR code. You only tap Send.</p>
    </AppShell>
  );
}
