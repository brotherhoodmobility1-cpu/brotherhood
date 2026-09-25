import AppShell from "@/components/app-shell";
import Cockpit from "@/components/cockpit";
import Plate from "@/components/plate";
import Empty from "@/components/empty";
import { requireTeam } from "@/lib/auth";
import { perDay, rupees } from "@/lib/format";
import { MIN_BALANCE, riderTag } from "@/lib/status";
import { dayNum, fromDayNum, istDate, whenIST } from "@/lib/ist";

type Rider = {
  id: string;
  full_name: string;
  mobile: string | null;
  weekly_rent: number;
  wallet_balance: number;
  action_needed: boolean;
  status: string;
  scooters: { code: string } | null;
};

function RiderRow({ r }: { r: Rider }) {
  const t = riderTag(r);
  return (
    <div className="row">
      <div className="m">
        <b>{r.full_name} · {r.scooters ? <Plate code={r.scooters.code} /> : "–"}</b>
        <small>Wallet {rupees(r.wallet_balance)} · {rupees(perDay(r.weekly_rent))}/day</small>
      </div>
      <span className={`tag ${t[0]}`}>{t[1]}</span>
      {r.mobile && <a className="tag" href={`tel:${r.mobile}`}>Call</a>}
    </div>
  );
}

function Section({ title, list, empty }: { title: string; list: Rider[]; empty: string }) {
  const shown = list.slice(0, 8);
  return (
    <>
      <h2>{title} ({list.length})</h2>
      {list.length === 0 ? <Empty text={empty} /> : shown.map((r) => <RiderRow key={r.id} r={r} />)}
      {list.length > shown.length && <p className="mute">…and {list.length - shown.length} more on the Riders page.</p>}
    </>
  );
}

export default async function DashboardPage() {
  const { supabase, profile } = await requireTeam();
  const owner = profile.role === "owner";

  const today = dayNum(istDate());
  const [sc, rd, enq, pays, al, cl] = await Promise.all([
    supabase.from("scooters").select("id, status"),
    supabase.from("riders")
      .select("id, full_name, mobile, weekly_rent, wallet_balance, action_needed, status, scooters(code)")
      .eq("status", "active")
      .order("scooter_id"),
    supabase.from("enquiries").select("*", { count: "exact", head: true }).eq("status", "new"),
    owner
      ? supabase.from("payments").select("amount, paid_at").eq("status", "paid").gte("paid_at", fromDayNum(today - 6) + "T00:00:00+05:30")
      : Promise.resolve({ data: [] as { amount: number; paid_at: string }[] }),
    supabase.from("alerts").select("id, slot, message, created_at").order("created_at", { ascending: false }).limit(10),
    supabase.from("payment_claims").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const scooters = sc.data ?? [];
  const riders = (rd.data ?? []) as unknown as Rider[];

  const total = scooters.length;
  const rented = scooters.filter((s) => s.status === "rented").length;
  const available = scooters.filter((s) => s.status === "available").length;
  const mech = scooters.filter((s) => s.status === "workshop").length;
  const action = riders.filter((r) => r.action_needed);
  const late = riders.filter((r) => !r.action_needed && Number(r.wallet_balance) < 0);
  const low = riders.filter((r) => Number(r.wallet_balance) >= 0 && Number(r.wallet_balance) < MIN_BALANCE);
  const dues = riders.reduce((a, r) => a + (Number(r.wallet_balance) < 0 ? -Number(r.wallet_balance) : 0), 0);

  const paid = ((pays.data ?? []) as { amount: number; paid_at: string }[]).map((p) => ({ d: dayNum(istDate(p.paid_at)), a: Number(p.amount) }));
  const collectedToday = paid.filter((p) => p.d === today).reduce((s, p) => s + p.a, 0);
  const collected7 = paid.reduce((s, p) => s + p.a, 0);
  const alerts = (al.data ?? []) as { id: number; slot: string; message: string; created_at: string }[];

  const odos = owner
    ? [
        { label: "Collected today", value: rupees(collectedToday) },
        { label: "Collected, last 7 days", value: rupees(collected7) },
        { label: "Pending dues", value: rupees(dues), tone: (dues ? "hot" : "") as "" | "hot" },
      ]
    : [
        { label: "Rented out", value: String(rented) },
        { label: "Available to allot", value: String(available) },
        { label: "With mechanic", value: String(mech), tone: (mech ? "warm" : "") as "" | "warm" },
      ];

  const lamps = [
    { icon: "Workshop", label: "With mechanic", n: mech, color: "#6f86ff", href: "/scooters" },
    { icon: "Alert", label: "Action needed", n: action.length, color: "#ff6b6b", href: "/riders" },
    { icon: "Payments", label: "Payments to confirm", n: cl.count ?? 0, color: "#3dbe78", href: "/payments" },
    { icon: "Payments", label: "Paying late", n: late.length, color: "#f2b705", href: "/riders" },
    { icon: "Battery", label: "Low balance", n: low.length, color: "#f2b705", href: "/riders" },
    { icon: "Enquiries", label: "New enquiries", n: enq.count ?? 0, color: "#3dbe78", href: "/enquiries" },
  ];

  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <Cockpit pct={total ? rented / total : 0} gaugeLabel={`Fleet in use · ${rented} of ${total} scooters`} odos={odos} lamps={lamps} />
      <Section title="Action needed: 2 days unpaid" list={action} empty="Nobody has passed the 2-day limit." />
      <Section title="Payment late" list={late} empty="No late payments." />
      <Section title={`Low balance (below ${rupees(MIN_BALANCE)})`} list={low} empty="Every wallet is above the minimum." />
      <h2>Alerts sent</h2>
      {alerts.length === 0 ? <Empty text="No alerts yet. Morning and evening reminders appear here once daily charges are switched on." /> : alerts.map((a) => (
        <div className="row" key={a.id}>
          <div className="m"><small>{a.slot === "morning" ? "Morning" : "Evening"} {whenIST(a.created_at)} · sent to rider, staff and owner</small>{a.message}</div>
        </div>
      ))}
    </AppShell>
  );
}
