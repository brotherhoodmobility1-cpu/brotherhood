import type { ReactNode } from "react";
import AppShell from "@/components/app-shell";
import Bars from "@/components/bars";
import Plate from "@/components/plate";
import { requireTeam } from "@/lib/auth";
import { rupees } from "@/lib/format";
import { MIN_BALANCE } from "@/lib/status";
import { ddmm, dayNum, fromDayNum, istDate } from "@/lib/ist";

type Pay = { amount: number; paid_at: string };
type Charge = { amount: number; for_date: string; rider_id: string; riders: { scooters: { code: string } | null } | null };
type Rider = { weekly_rent: number; wallet_balance: number; security_deposit: number; action_needed: boolean; status: string; settlement: number | null };

function Kpi({ v, l, sub }: { v: string; l: string; sub?: ReactNode }) {
  return (
    <div className="stat">
      <b style={{ fontSize: 22 }}>{v}</b>
      <span>{l}</span>
      {sub && <small style={{ display: "block", fontSize: 12, color: "var(--mute)", marginTop: 2 }}>{sub}</small>}
    </div>
  );
}

function change(a: number, b: number) {
  if (!b) return a ? "new this week" : "";
  const p = Math.round(((a - b) / b) * 100);
  return <span style={{ color: p >= 0 ? "var(--ev)" : "var(--bad)" }}>{p >= 0 ? "▲ " : "▼ "}{Math.abs(p)}% vs previous 7 days</span>;
}

export default async function AnalyticsPage() {
  const { supabase, profile } = await requireTeam(["owner"]);
  const today = dayNum(istDate());
  const from = fromDayNum(today - 41);
  const [{ data: pays }, { data: charges }, { data: riders }, { data: scooters }] = await Promise.all([
    supabase.from("payments").select("amount, paid_at").eq("status", "paid").gte("paid_at", from + "T00:00:00+05:30"),
    supabase.from("wallet_ledger").select("amount, for_date, rider_id, riders(scooters(code))").eq("kind", "daily_charge").gte("for_date", from),
    supabase.from("riders").select("weekly_rent, wallet_balance, security_deposit, action_needed, status, settlement"),
    supabase.from("scooters").select("status"),
  ]);
  const P = ((pays ?? []) as Pay[]).map((p) => ({ d: dayNum(istDate(p.paid_at)), a: Number(p.amount) }));
  const C = ((charges ?? []) as unknown as Charge[]).map((c) => ({ d: dayNum(c.for_date), a: -Number(c.amount), code: c.riders?.scooters?.code ?? "–" }));
  const sum = (L: { d: number; a: number }[], a: number, b: number) => L.reduce((s, x) => (x.d >= a && x.d <= b ? s + x.a : s), 0);
  const R = (riders ?? []) as Rider[];
  const act = R.filter((r) => r.status === "active");
  const S = scooters ?? [];

  const cT = sum(P, today, today), cW = sum(P, today - 6, today), cL = sum(P, today - 13, today - 7), cM = sum(P, today - 29, today);
  const eW = sum(C, today - 6, today), eL = sum(C, today - 13, today - 7), eM = sum(C, today - 29, today);
  const expected = act.reduce((a, r) => a + Number(r.weekly_rent), 0);
  const dues = act.reduce((a, r) => a + (Number(r.wallet_balance) < 0 ? -Number(r.wallet_balance) : 0), 0);
  const deps = act.reduce((a, r) => a + Number(r.security_deposit), 0);
  const wal = act.reduce((a, r) => a + Math.max(0, Number(r.wallet_balance)), 0);
  const past = R.filter((r) => r.status === "closed");
  const refunds = past.reduce((a, r) => a + Math.max(0, Number(r.settlement ?? 0)), 0);
  const owed = past.reduce((a, r) => a + Math.max(0, -Number(r.settlement ?? 0)), 0);

  const days = Array.from({ length: 14 }, (_, k) => today - 13 + k).map((d) => ({ label: ddmm(fromDayNum(d)), values: [sum(P, d, d)] }));
  const weeks = Array.from({ length: 6 }, (_, k) => {
    const e = today - 7 * (5 - k), s = e - 6;
    return { label: `${ddmm(fromDayNum(s))}–${ddmm(fromDayNum(e))}`, values: [sum(P, s, e), sum(C, s, e)] };
  });
  const byScooter = new Map<string, number>();
  C.filter((c) => c.d >= today - 29).forEach((c) => byScooter.set(c.code, (byScooter.get(c.code) ?? 0) + c.a));
  const top = [...byScooter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const best = days.reduce((m, d) => (d.values[0] > m.values[0] ? d : m), days[0]);

  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <h2>Money collected</h2>
      <div className="stats">
        <Kpi v={rupees(cT)} l="Collected today" />
        <Kpi v={rupees(cW)} l="Collected, last 7 days" sub={change(cW, cL)} />
        <Kpi v={rupees(cM)} l="Collected, last 30 days" />
        <Kpi v={rupees(Math.round(cW / 7))} l="Average per day" sub="last 7 days" />
      </div>
      <div className="row" style={{ display: "block" }}>
        <b>Collected per day, last 14 days</b>
        <Bars rows={days} series={[{ name: "Collected", color: "var(--ev)" }]} />
        {best.values[0] > 0 && <p className="mute" style={{ fontSize: 12.5, margin: "4px 0 0" }}>Best day {rupees(best.values[0])} on {best.label}</p>}
      </div>

      <h2>Weekly revenue</h2>
      <div className="stats">
        <Kpi v={rupees(eW)} l="Rent earned, last 7 days" sub={change(eW, eL)} />
        <Kpi v={rupees(expected)} l="Expected weekly rent" sub={`from ${act.length} active riders`} />
        <Kpi v={rupees(eM)} l="Rent earned, last 30 days" />
      </div>
      <div className="row" style={{ display: "block" }}>
        <b>Collected vs rent earned, by week</b>
        <Bars rows={weeks} series={[{ name: "Collected", color: "var(--ev)" }, { name: "Rent earned", color: "#4a90d9" }]} />
        <div style={{ overflowX: "auto" }}>
          <table className="tb">
            <thead><tr><th>Week</th><th>Collected</th><th>Rent earned</th></tr></thead>
            <tbody>{[...weeks].reverse().map((w) => <tr key={w.label}><td>{w.label}</td><td>{rupees(w.values[0])}</td><td>{rupees(w.values[1])}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <h2>Money held and pending</h2>
      <div className="stats">
        <Kpi v={rupees(dues)} l="Pending dues (wallets in minus)" />
        <Kpi v={rupees(deps)} l="Security deposits held" />
        <Kpi v={rupees(wal)} l="Rider wallet balances" sub="prepaid, not yet earned" />
        <Kpi v={rupees(refunds)} l="Refunds on returns" sub={owed ? `${rupees(owed)} still owed by past riders` : ""} />
      </div>

      <h2>Fleet and riders</h2>
      <div className="stats">
        <Kpi v={`${S.length ? Math.round((S.filter((s) => s.status === "rented").length / S.length) * 100) : 0}%`} l="Fleet in use" sub={`${S.filter((s) => s.status === "rented").length} of ${S.length} scooters`} />
        <Kpi v={String(S.filter((s) => s.status === "available").length)} l="Available to allot" />
        <Kpi v={String(S.filter((s) => s.status === "workshop").length)} l="With mechanic" />
        <Kpi v={String(R.filter((r) => r.status === "waiting").length)} l="Waiting for scooter" />
        <Kpi v={String(act.filter((r) => r.action_needed).length)} l="Action needed (2 days unpaid)" />
        <Kpi v={String(act.filter((r) => !r.action_needed && Number(r.wallet_balance) < 0).length)} l="Paying late" />
        <Kpi v={String(act.filter((r) => Number(r.wallet_balance) >= 0 && Number(r.wallet_balance) < MIN_BALANCE).length)} l="Low balance" />
        <Kpi v={String(past.length)} l="Past riders" />
      </div>

      <h2>Top scooters by rent earned, last 30 days</h2>
      {top.length === 0 ? <p className="mute">Appears once daily charges start.</p> : (
        <div style={{ overflowX: "auto" }}>
          <table className="tb">
            <thead><tr><th>Scooter</th><th>Rent earned</th></tr></thead>
            <tbody>{top.map(([code, a]) => <tr key={code}><td><Plate code={code} /></td><td>{rupees(a)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      <p className="note">Collected = recharges and cash received. Rent earned = daily charges taken from wallets.</p>
    </AppShell>
  );
}
