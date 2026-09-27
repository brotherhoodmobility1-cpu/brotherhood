"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { formatDate, rupees } from "@/lib/format";
import { recordPayment } from "@/app/payments/actions";

export default function ReceivedButton({ riderId, name, code, amount, wallet, weeklyRent, nextWeek }: {
  riderId: string; name: string; code: string; amount: number; wallet: number; weeklyRent: number; nextWeek: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"" | "form" | "check" | "done">("");
  const [amt, setAmt] = useState(String(Math.round(amount)));
  const [method, setMethod] = useState<"cash" | "upi">("upi");
  const [ref, setRef] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [receipt, setReceipt] = useState("");
  const n = Math.round(Number(amt) || 0);
  const after = Number(wallet) + n;

  async function save() {
    setBusy(true); setErr("");
    try {
      let path: string | undefined;
      if (photo) {
        const blob = await compressImage(photo);
        path = `office/${riderId}-${Date.now()}.jpg`;
        const { error } = await createClient().storage.from("payment-proofs").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw new Error("Couldn't upload the receipt photo.");
      }
      const res = await recordPayment(riderId, n, method, ref, path);
      if (!res.ok) throw new Error(res.error);
      setReceipt(res.receipt); setStep("done"); setPhoto(null); setRef("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setStep("form");
    }
    setBusy(false);
  }

  return (
    <>
      <button className="a p" onClick={() => { setAmt(String(Math.round(amount))); setErr(""); setStep("form"); }}>✓ Payment received</button>
      <Modal open={step === "form"} onClose={() => setStep("")}>
        <h2>Payment received from {name}</h2>
        <p className="mute">{code} · weekly rent {rupees(weeklyRent)} · wallet now {rupees(wallet)}</p>
        <label>Amount received (₹)</label>
        <input type="number" inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <label>Paid by</label>
        <select value={method} onChange={(e) => setMethod(e.target.value as "cash" | "upi")}>
          <option value="upi">UPI / QR (seen in our bank app)</option>
          <option value="cash">Cash</option>
        </select>
        {method === "upi" && (<><label>UPI reference (optional)</label><input value={ref} onChange={(e) => setRef(e.target.value)} /></>)}
        <label>Receipt photo (optional)</label>
        <label style={{ display: "block", border: "1.5px dashed var(--mute)", borderRadius: 10, padding: 12, textAlign: "center", cursor: "pointer", color: "var(--ink)", marginBottom: 10 }}>
          {photo ? `✓ ${photo.name}` : "Tap to add the screenshot or a photo of the receipt"}
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
        {err && <p className="lerr" role="alert">{err}</p>}
        <div className="btns">
          <button className="a" onClick={() => setStep("")}>Cancel</button>
          <button className="a p" onClick={() => (n > 0 ? (setErr(""), setStep("check")) : setErr("Enter the amount received."))}>Continue</button>
        </div>
      </Modal>
      <Modal open={step === "check"} onClose={() => !busy && setStep("form")}>
        <h2>Check before saving</h2>
        <p>Record <b>{rupees(n)}</b> ({method === "cash" ? "cash" : "UPI"}) from <b>{name}</b>?</p>
        <p className="mute">Wallet {rupees(wallet)} → <b>{rupees(after)}</b>.{" "}
          {after >= weeklyRent && nextWeek ? `This week is covered; the next payment day becomes ${formatDate(nextWeek)}.` : after >= weeklyRent ? "This week is covered." : `Still ${rupees(weeklyRent - after)} short of a full week.`}</p>
        <div className="btns">
          <button className="a" onClick={() => setStep("form")} disabled={busy}>Go back</button>
          <button className="a p" onClick={save} disabled={busy}>{busy ? "Saving…" : "Yes, payment received"}</button>
        </div>
      </Modal>
      <Modal open={step === "done"} onClose={() => setStep("")}>
        <div className="okm">
          <div className="okc"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
          <h2>Payment recorded</h2>
          <p>{rupees(n)} from {name} · receipt <b>{receipt}</b></p>
          {after >= weeklyRent && nextWeek && <p className="mute">Next payment day: <b>{formatDate(nextWeek)}</b></p>}
          <div className="btns" style={{ justifyContent: "center" }}><button className="a p" onClick={() => setStep("")}>Okay</button></div>
        </div>
      </Modal>
    </>
  );
}
