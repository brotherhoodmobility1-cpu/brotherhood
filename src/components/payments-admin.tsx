"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import Plate from "./plate";
import Empty from "./empty";
import ReceiptModal, { type Receipt, whenIST } from "./receipt-modal";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { rupees } from "@/lib/format";
import { adjustWallet, confirmClaim, recordPayment, rejectClaim, saveUpiSettings } from "@/app/payments/actions";

export type PayRow = {
  id: number; amount: number; method: string; receipt_no: string; razorpay_payment_id: string | null; utr: string | null; paid_at: string;
  riders: { full_name: string; scooters: { code: string } | null } | null;
};
export type RiderPick = { id: string; full_name: string; wallet_balance: number; scooters: { code: string } | null };
export type ClaimRow = {
  id: number; amount: number; utr: string | null; created_at: string; proofUrl?: string;
  riders: { full_name: string; wallet_balance: number; scooters: { code: string } | null } | null;
};

type Ask = { title: string; body: ReactNode; yes: string; danger?: boolean; run: () => Promise<{ ok: boolean; error: string; receipt: string }>; done?: (receipt: string) => string };

export default function PaymentsAdmin({ owner, pays, riders, claims, upiId, qrUrl }: {
  owner: boolean; pays: PayRow[]; riders: RiderPick[]; claims: ClaimRow[]; upiId: string; qrUrl: string | null;
}) {
  const router = useRouter();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [form, setForm] = useState<{ kind: "pay" | "adjust"; rider: string; amount: string; method: "cash" | "upi"; ref: string; note: string } | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [big, setBig] = useState("");
  const [reason, setReason] = useState("");
  const [upi, setUpi] = useState(upiId);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [savingQr, setSavingQr] = useState(false);
  const total = pays.reduce((a, p) => a + Number(p.amount), 0);

  async function run() {
    if (!ask) return;
    setBusy(true);
    const res = await ask.run();
    setBusy(false);
    const a = ask;
    setAsk(null);
    if (!res.ok) { setErr(res.error); return; }
    setErr("");
    setOk(a.done ? a.done(res.receipt) : "Saved.");
    setForm(null);
    router.refresh();
  }

  async function saveQr() {
    setSavingQr(true);
    setErr("");
    try {
      if (qrFile) {
        const blob = await compressImage(qrFile, 1000, 0.9);
        const { error } = await createClient().storage.from("brand").upload("payment-qr.jpg", blob, { contentType: "image/jpeg", upsert: true });
        if (error) throw error;
      }
      const res = await saveUpiSettings(upi, !!qrFile);
      if (!res.ok) throw new Error(res.error);
      setQrFile(null);
      setOk("Payment QR code and UPI ID saved.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save the QR code.");
    } finally {
      setSavingQr(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="a p" onClick={() => setForm({ kind: "pay", rider: riders[0]?.id ?? "", amount: "", method: "cash", ref: "", note: "" })}>Record payment</button>
        {owner && <button className="a" onClick={() => setForm({ kind: "adjust", rider: riders[0]?.id ?? "", amount: "", method: "cash", ref: "", note: "Opening balance" })}>Adjust wallet</button>}
      </div>
      {err && <p className="lerr" role="alert" style={{ marginTop: 10 }}>{err}</p>}
      {ok && <p className="tag" style={{ display: "inline-block", marginTop: 10 }}>{ok}</p>}

      <h2>Waiting for confirmation ({claims.length})</h2>
      {claims.length === 0 ? <Empty text="Nothing to check. When a rider pays by QR and uploads the receipt, it appears here." /> : claims.map((c) => (
        <div className="row" key={c.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.proofUrl} alt="Payment receipt" onClick={() => setBig(c.proofUrl ?? "")}
            style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, cursor: "zoom-in", flex: "none" }} />
          <div className="m">
            <b>{c.riders?.full_name} · {c.riders?.scooters && <Plate code={c.riders.scooters.code} />}</b>
            <small>{rupees(c.amount)} · sent {whenIST(c.created_at)}{c.utr ? ` · UPI ref ${c.utr}` : ""} · wallet now {rupees(c.riders?.wallet_balance ?? 0)}</small>
          </div>
          <button className="a p" onClick={() => setAsk({
            title: `Confirm ${rupees(c.amount)} from ${c.riders?.full_name}?`,
            body: <p className="mute">Check the money has actually arrived in your bank or UPI app{c.utr ? ` (reference ${c.utr})` : ""}. The rider&apos;s wallet goes to <b>{rupees(Number(c.riders?.wallet_balance ?? 0) + Number(c.amount))}</b> and a receipt is created.</p>,
            yes: "Yes, money received",
            run: () => confirmClaim(c.id),
            done: (rc) => `Payment confirmed. Receipt ${rc}.`,
          })}>Confirm</button>
          <button className="a" onClick={() => { setReason(""); reasonRef.current = ""; setAsk({
            title: `Reject this payment from ${c.riders?.full_name}?`,
            body: null,
            yes: "Yes, reject",
            danger: true,
            run: () => rejectClaim(c.id, reasonRef.current),
            done: () => "Payment rejected. The rider sees it as not accepted.",
          }); }}>Reject</button>
        </div>
      ))}

      <h2>All payments ({pays.length})</h2>
      <p className="mute">Total received {rupees(total)}</p>
      {pays.length === 0 ? <Empty text="No payments yet. Confirmed and recorded payments appear here with their receipt." /> : (
        <div style={{ overflowX: "auto" }}>
          <table className="tb">
            <thead><tr><th>Date</th><th>Rider</th><th>Amount</th><th>Paid by</th><th>Receipt</th></tr></thead>
            <tbody>
              {pays.map((p) => (
                <tr key={p.id}>
                  <td>{whenIST(p.paid_at)}</td>
                  <td>{p.riders?.full_name}<br />{p.riders?.scooters && <Plate code={p.riders.scooters.code} />}</td>
                  <td><b>{rupees(p.amount)}</b></td>
                  <td>{p.method === "cash" ? "Cash" : "UPI"}{p.utr || p.razorpay_payment_id ? <><br /><code style={{ fontSize: 12 }}>{p.utr ?? p.razorpay_payment_id}</code></> : null}</td>
                  <td><button className="a" onClick={() => setReceipt({ ...p, rider: p.riders?.full_name, code: p.riders?.scooters?.code })}>{p.receipt_no}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {owner && (
        <>
          <h2>Payment QR code and UPI ID</h2>
          <div className="row" style={{ display: "block" }}>
            <p className="mute" style={{ marginTop: 0 }}>Riders see this when they tap Pay.</p>
            {qrUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="Current payment QR code" style={{ width: 160, borderRadius: 10, background: "#fff", padding: 6, display: "block", marginBottom: 10 }} />
            )}
            <label>UPI ID</label>
            <input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="e.g. brotherhood@okaxis" />
            <label>{qrUrl ? "Replace QR code image" : "Upload QR code image"}</label>
            <label style={{ display: "block", border: "1.5px dashed var(--mute)", borderRadius: 10, padding: 12, textAlign: "center", cursor: "pointer", color: "var(--ink)", marginBottom: 10 }}>
              {qrFile ? `✓ ${qrFile.name}` : "Tap to choose the QR code photo"}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setQrFile(e.target.files?.[0] ?? null)} />
            </label>
            <button className="a p" onClick={saveQr} disabled={savingQr}>{savingQr ? "Saving…" : "Save payment details"}</button>
          </div>
        </>
      )}

      <Modal open={!!form && !ask} onClose={() => setForm(null)}>
        {form && (
          <>
            <h2>{form.kind === "pay" ? "Record payment" : "Adjust wallet"}</h2>
            <p className="mute">{form.kind === "pay"
              ? "For cash at the office, or UPI you can already see in your bank app. It's added to the wallet with a receipt."
              : "For opening balances or corrections. Use a minus amount to deduct. This isn't counted as money collected."}</p>
            <label>Rider</label>
            <select value={form.rider} onChange={(e) => setForm({ ...form, rider: e.target.value })}>
              {riders.map((r) => <option key={r.id} value={r.id}>{r.full_name} · {r.scooters?.code} · wallet {rupees(r.wallet_balance)}</option>)}
            </select>
            <label>Amount (₹)</label>
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            {form.kind === "pay" ? (
              <>
                <label>Paid by</label>
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as "cash" | "upi" })}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                </select>
                {form.method === "upi" && (<><label>UPI reference (optional)</label><input value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} /></>)}
              </>
            ) : (<><label>Reason</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></>)}
            <div className="btns">
              <button className="a" onClick={() => setForm(null)}>Cancel</button>
              <button className="a p" onClick={() => {
                const pick = riders.find((r) => r.id === form.rider);
                const amt = Math.round(Number(form.amount));
                if (!amt || !pick) { setErr("Choose the rider and enter an amount."); return; }
                setErr("");
                const f = form;
                setAsk({
                  title: "Check before saving",
                  body: <><p>{f.kind === "pay" ? `${f.method === "cash" ? "Cash" : "UPI"} payment of` : "Adjust wallet by"} <b>{rupees(amt)}</b> for <b>{pick.full_name}</b>?</p>
                    <p className="mute">Wallet {rupees(pick.wallet_balance)} → <b>{rupees(Number(pick.wallet_balance) + amt)}</b></p></>,
                  yes: "Yes, save",
                  danger: true,
                  run: () => (f.kind === "pay" ? recordPayment(f.rider, amt, f.method, f.ref) : adjustWallet(f.rider, amt, f.note)),
                  done: (rc) => (f.kind === "pay" ? `Payment recorded. Receipt ${rc}.` : "Wallet adjusted."),
                });
              }}>Continue</button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!ask} onClose={() => !busy && setAsk(null)}>
        {ask && (
          <>
            <h2>{ask.title}</h2>
            {ask.body}
            {ask.body === null && (
              <>
                <p className="mute">The rider is told it wasn&apos;t accepted. Add a short reason they&apos;ll see.</p>
                <input value={reason} onChange={(e) => { setReason(e.target.value); reasonRef.current = e.target.value; }} placeholder="e.g. Amount not received, screenshot unclear" />
              </>
            )}
            <div className="btns">
              <button className="a" onClick={() => setAsk(null)} disabled={busy}>Go back</button>
              <button className={`a ${ask.danger ? "d" : "p"}`} onClick={run} disabled={busy}>{busy ? "Working…" : ask.yes}</button>
            </div>
          </>
        )}
      </Modal>
      <Modal open={!!big} onClose={() => setBig("")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={big} alt="Payment receipt" style={{ width: "100%", borderRadius: 8 }} />
        <div className="btns" style={{ marginTop: 10 }}><button className="a" onClick={() => setBig("")}>Close</button></div>
      </Modal>
      <ReceiptModal r={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}

const reasonRef = { current: "" };
