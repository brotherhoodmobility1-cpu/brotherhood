import AppShell from "@/components/app-shell";
import Plate from "@/components/plate";
import Empty from "@/components/empty";
import WhatsAppButton from "@/components/whatsapp-button";
import ReceivedButton from "@/components/received-button";
import ConfirmClaimButton from "@/components/confirm-claim-button";
import { requireTeam } from "@/lib/auth";
import { displayDue, formatDate, nextDue, rupees } from "@/lib/format";
import { istDate } from "@/lib/ist";

type Rider = {
  id: string; full_name: string; mobile: string | null; start_date: string | null; weekly_rent: number; wallet_balance: number;
  action_needed: boolean; rent_on_hold: boolean; late_days: number; scooters: { code: string; chassis_no: string | null } | null;
};
type Claim = { id: number; rider_id: string; amount: number; utr: string | null; proof_path: string };

export default async function TodayPage() {
  const { supabase, profile } = await requireTeam();
  const today = istDate();
  const [{ data: rows }, { data: claimRows }, { data: paidToday }, { data: settings }] = await Promise.all([
    supabase.from("riders")
      .select("id, full_name, mobile, start_date, weekly_rent, wallet_balance, action_needed, rent_on_hold, late_days, scooters(code, chassis_no)")
      .eq("status", "active").order("scooter_id"),
    supabase.from("payment_claims").select("id, rider_id, amount, utr, proof_path").eq("status", "pending").order("created_at"),
    supabase.from("payments").select("rider_id, amount").eq("status", "paid").gte("paid_at", today + "T00:00:00+05:30"),
    supabase.from("app_settings").select("key, value").in("key", ["upi_id", "qr_version"]),
  ]);
  const set = Object.fromEntries(((settings ?? []) as { key: string; value: string }[]).map((s) => [s.key, s.value]));
  const qrUrl = set.qr_version ? `${supabase.storage.from("brand").getPublicUrl("payment-qr.jpg").data.publicUrl}?v=${set.qr_version}` : null;
  const upiId = set.upi_id ?? "";

  const claims = (claimRows ?? []) as Claim[];
  const photo: Record<string, string> = {};
  if (claims.length) {
    const { data: signed } = await supabase.storage.from("payment-proofs").createSignedUrls(claims.map((c) => c.proof_path), 3600);
    (signed ?? []).forEach((s) => { if (s.path && s.signedUrl) photo[s.path] = s.signedUrl; });
  }
  const claimOf = new Map<string, Claim>();
  claims.forEach((c) => { if (!claimOf.has(c.rider_id)) claimOf.set(c.rider_id, c); });
  const paid = new Map<string, number>();
  ((paidToday ?? []) as { rider_id: string; amount: number }[]).forEach((p) => paid.set(p.rider_id, (paid.get(p.rider_id) ?? 0) + Number(p.amount)));

  const riders = (rows ?? []) as unknown as Rider[];
  const covered = (r: Rider) => Number(r.wallet_balance) >= Number(r.weekly_rent);
  const dueToday = riders.filter((r) => nextDue(r.start_date) === today);
  const late = riders.filter((r) => nextDue(r.start_date) !== today && Number(r.wallet_balance) < 0);
  const paidCount = dueToday.filter(covered).length;
  const waitingCount = dueToday.filter((r) => !covered(r) && claimOf.has(r.id)).length;
  const notPaid = dueToday.length - paidCount - waitingCount;

  const Row = ({ r, kind }: { r: Rider; kind: "due" | "reminder" }) => {
    const c = claimOf.get(r.id);
    const ok = kind === "due" ? covered(r) : Number(r.wallet_balance) >= 0;
    const nextWeek = new Date(Date.parse(today + "T00:00:00Z") + 7 * 86400000).toISOString().slice(0, 10);
    const tag: [string, string] = ok
      ? ["", `✓ Paid${paid.get(r.id) ? ` ${rupees(paid.get(r.id)!)} today` : ""} · next payment ${formatDate(displayDue(r.start_date, r.wallet_balance, r.weekly_rent))}`]
      : c ? ["due", `Receipt uploaded ${rupees(c.amount)} · check it`]
      : kind === "due" ? ["bad", "Not paid yet"] : ["bad", r.action_needed ? "2 days unpaid" : `Late, day ${r.late_days} of 2`];
    const ask = kind === "due" ? Number(r.weekly_rent) : Math.max(0, Number(r.weekly_rent) - Number(r.wallet_balance));
    return (
      <div className="row">
        <div className="m">
          <b>{r.full_name} · {r.scooters && <Plate code={r.scooters.code} />}</b>
          <small>
            Chassis {r.scooters?.chassis_no ?? "–"} · {r.mobile ?? "mobile missing"} · weekly rent {rupees(r.weekly_rent)} · wallet {rupees(r.wallet_balance)}
            {r.rent_on_hold ? " · rent on hold" : ""}
          </small>
        </div>
        <span className={`tag ${tag[0]}`}>{tag[1]}</span>
        {r.mobile && <a className="tag" href={`tel:${r.mobile}`}>Call</a>}
        {!ok && (
          <WhatsAppButton kind={kind} qrUrl={qrUrl} upiId={upiId}
            r={{ name: r.full_name, mobile: r.mobile, code: r.scooters?.code ?? "", chassis: r.scooters?.chassis_no, weeklyRent: r.weekly_rent, wallet: r.wallet_balance, startDate: r.start_date }} />
        )}
        {!ok && c && (
          <ConfirmClaimButton claimId={c.id} name={r.full_name} amount={c.amount} utr={c.utr} photoUrl={photo[c.proof_path] ?? ""} wallet={r.wallet_balance} path={c.proof_path} />
        )}
        {!ok && !c && (
          <ReceivedButton riderId={r.id} name={r.full_name} code={r.scooters?.code ?? ""} amount={ask}
            wallet={r.wallet_balance} weeklyRent={r.weekly_rent} nextWeek={kind === "due" ? nextWeek : null} />
        )}
      </div>
    );
  };

  const order = (r: Rider) => (covered(r) ? 2 : claimOf.has(r.id) ? 1 : 0);

  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <h2>Payment day today · {formatDate(today)}</h2>
      <div className="stats">
        <div className="stat"><b>{dueToday.length}</b><span>Riders due today</span></div>
        <div className="stat"><b style={{ color: notPaid ? "var(--bad)" : undefined }}>{notPaid}</b><span>Not paid yet</span></div>
        <div className="stat"><b>{waitingCount}</b><span>Receipts to check</span></div>
        <div className="stat"><b style={{ color: "var(--ev)" }}>{paidCount}</b><span>Paid</span></div>
      </div>
      <p className="mute">
        For each rider: <b>WhatsApp</b> sends the payment-day message with your QR. When the money comes in, tap <b>✓ Payment received</b>
        (or <b>Check receipt</b> if the rider uploaded one). Their next payment day then moves to next week.
      </p>
      {dueToday.length === 0 ? <Empty text="Nobody's weekly payment falls on today." /> :
        [...dueToday].sort((a, b) => order(a) - order(b)).map((r) => <Row key={r.id} r={r} kind="due" />)}

      <h2>Payment pending from earlier ({late.length})</h2>
      {late.length === 0 ? <p className="mute">Nobody is late.</p> : late.map((r) => <Row key={r.id} r={r} kind="reminder" />)}
    </AppShell>
  );
}
