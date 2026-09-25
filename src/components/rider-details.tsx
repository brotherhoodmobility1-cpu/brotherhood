"use client";

import { useEffect, useState, type ReactNode } from "react";
import Modal from "./modal";
import Plate from "./plate";
import WhatsAppButton from "./whatsapp-button";
import ReceiptModal, { type Receipt } from "./receipt-modal";
import { createClient } from "@/lib/supabase/client";
import { formatDate, nextDue, perDay, rupees } from "@/lib/format";
import { whenIST } from "@/lib/ist";
import { DOC_COUNT } from "@/lib/docs";
import { riderTag } from "@/lib/status";

type Detail = {
  rider: {
    id: string; full_name: string; status: string; mobile: string | null; start_date: string | null; weekly_rent: number; security_deposit: number;
    wallet_balance: number; late_days: number; action_needed: boolean; rent_on_hold: boolean; profile_id: string | null;
    scooters: { code: string; chassis_no: string | null } | null; profiles: { must_change_password: boolean } | null;
  };
  docs: { status: string }[];
  sig: { version: number; signed_at: string } | null;
  version: number;
  pays: (Receipt & { id: number })[];
  ledger: { id: number; amount: number; kind: string; note: string | null; created_at: string }[];
  alerts: { id: number; slot: string; kind: string; created_at: string }[];
  loc: { updated_at: string } | null;
  job: { ticket: string; issue: string | null } | null;
};

export default function RiderDetails({ riderId, onClose, qrUrl, upiId }: { riderId: string | null; onClose: () => void; qrUrl: string | null; upiId: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    if (!riderId) { setD(null); return; }
    const s = createClient();
    (async () => {
      setErr("");
      const [r, docs, sig, tpl, pays, ledger, alerts, loc, job] = await Promise.all([
        s.from("riders").select("id, full_name, status, mobile, start_date, weekly_rent, security_deposit, wallet_balance, late_days, action_needed, rent_on_hold, profile_id, scooters(code, chassis_no), profiles(must_change_password)").eq("id", riderId).single(),
        s.from("documents").select("status").eq("rider_id", riderId),
        s.from("rider_agreements").select("version, signed_at").eq("rider_id", riderId).order("version", { ascending: false }).limit(1).maybeSingle(),
        s.from("agreement_templates").select("version").order("version", { ascending: false }).limit(1).maybeSingle(),
        s.from("payments").select("id, amount, method, receipt_no, razorpay_payment_id, utr, paid_at").eq("rider_id", riderId).eq("status", "paid").order("paid_at", { ascending: false }).limit(10),
        s.from("wallet_ledger").select("id, amount, kind, note, created_at").eq("rider_id", riderId).order("created_at", { ascending: false }).limit(10),
        s.from("alerts").select("id, slot, kind, created_at").eq("rider_id", riderId).order("created_at", { ascending: false }).limit(5),
        s.from("rider_locations").select("updated_at").eq("rider_id", riderId).maybeSingle(),
        s.from("jobs").select("ticket, issue").eq("rider_id", riderId).eq("status", "open").maybeSingle(),
      ]);
      if (r.error || !r.data) { setErr("Couldn't load this rider."); return; }
      setD({
        rider: r.data as unknown as Detail["rider"],
        docs: (docs.data ?? []) as Detail["docs"],
        sig: sig.data ?? null,
        version: tpl.data?.version ?? 1,
        pays: (pays.data ?? []) as Detail["pays"],
        ledger: (ledger.data ?? []) as Detail["ledger"],
        alerts: (alerts.data ?? []) as Detail["alerts"],
        loc: loc.data ?? null,
        job: job.data ?? null,
      });
    })();
  }, [riderId]);

  if (!riderId) return null;
  const row = (a: string, b: ReactNode) => <div className="pt"><span className="mute">{a}</span><b style={{ textAlign: "right" }}>{b}</b></div>;

  return (
    <>
      <Modal open onClose={onClose}>
        {err && <p className="lerr">{err}</p>}
        {!d && !err && <p className="mute">Loading…</p>}
        {d && (() => {
          const r = d.rider, w = Number(r.wallet_balance), dep = Number(r.security_deposit), day = perDay(r.weekly_rent);
          const used = w < 0 ? Math.min(dep, -w) : 0, cov = w > 0 ? Math.floor(w / day) : 0, t = riderTag(r);
          const verified = d.docs.filter((x) => x.status === "verified").length, uploaded = d.docs.filter((x) => x.status !== "rejected").length;
          const login = !r.profile_id ? "No login yet" : r.profiles?.must_change_password ? "Temporary password" : "Password set";
          const ag = !d.sig ? "Not signed" : d.sig.version < d.version ? "Old version, sign again" : `Signed ${whenIST(d.sig.signed_at)}`;
          return (
            <>
              <h2>{r.full_name} · {r.scooters && <Plate code={r.scooters.code} />}</h2>
              <p>
                <span className={`tag ${t[0]}`}>{t[1]}</span>{" "}
                {r.rent_on_hold && <span className="tag due">Rent on hold</span>}{" "}
                {d.job && <span className="tag bad">Breakdown {d.job.ticket}</span>}
              </p>
              {row("Chassis", r.scooters?.chassis_no ?? "–")}
              {row("Mobile", r.mobile ?? "Not set")}
              {row("Login", login)}
              {row("Started", formatDate(r.start_date))}
              {row("Next rent due", formatDate(nextDue(r.start_date)))}
              {row("Daily charge", `${rupees(day)} (${rupees(r.weekly_rent)}/week)`)}
              {row("Wallet", <span style={{ color: w < 0 ? "var(--bad)" : undefined }}>{rupees(w)}</span>)}
              {row("Balance covers", `${cov} ${cov === 1 ? "day" : "days"}`)}
              {w < 0 && row("Days late", `${r.late_days} of 2`)}
              {row("Security deposit", `${rupees(dep - used)}${used ? ` (${rupees(used)} used)` : ""}`)}
              {row("Documents", `${verified} of ${DOC_COUNT} verified · ${uploaded} uploaded`)}
              {row("Agreement", ag)}
              {row("Location", d.loc ? `Last shared ${whenIST(d.loc.updated_at)}` : "Not shared yet")}

              <h2>Payments</h2>
              {d.pays.length === 0 ? <p className="mute">No payments yet.</p> : d.pays.map((p) => (
                <div className="pt" key={p.id}>
                  <span>{whenIST(p.paid_at)} · {p.method === "cash" ? "Cash" : "UPI"}</span>
                  <span><b>{rupees(p.amount)}</b> <button className="a" onClick={() => setReceipt({ ...p, rider: r.full_name, code: r.scooters?.code })}>{p.receipt_no}</button></span>
                </div>
              ))}

              <h2>Alerts</h2>
              {d.alerts.length === 0 ? <p className="mute">None.</p> : d.alerts.map((a) => (
                <div className="pt" key={a.id}>
                  <span>{a.slot === "morning" ? "Morning" : "Evening"} {whenIST(a.created_at)}</span>
                  <small style={{ color: `var(--${a.kind === "low" ? "due" : "bad"})` }}>{a.kind === "low" ? "Low balance" : a.kind === "late" ? "Payment late" : "Action needed"}</small>
                </div>
              ))}

              <h2>Wallet history</h2>
              {d.ledger.length === 0 ? <p className="mute">No entries yet.</p> : d.ledger.map((l) => (
                <div className="pt" key={l.id}>
                  <span>{whenIST(l.created_at)} · {l.kind === "daily_charge" ? "Daily charge" : l.kind === "recharge" ? `Payment ${l.note ?? ""}` : l.kind === "repair_charge" ? l.note ?? "Repair charge" : l.note ?? "Adjustment"}</span>
                  <b style={{ color: Number(l.amount) < 0 ? "var(--bad)" : "var(--ev)" }}>{Number(l.amount) < 0 ? "-" : "+"}{rupees(Math.abs(Number(l.amount)))}</b>
                </div>
              ))}

              <div className="btns" style={{ marginTop: 12 }}>
                {r.mobile && <a className="a" style={{ textDecoration: "none", padding: "8px 13px", border: "1.5px solid var(--line)", borderRadius: 10 }} href={`tel:${r.mobile}`}>Call</a>}
                <WhatsAppButton r={{ name: r.full_name, mobile: r.mobile, code: r.scooters?.code ?? "", weeklyRent: r.weekly_rent, wallet: w, startDate: r.start_date }} qrUrl={qrUrl} upiId={upiId} />
                <button className="a p" onClick={onClose}>Close</button>
              </div>
            </>
          );
        })()}
      </Modal>
      <ReceiptModal r={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
