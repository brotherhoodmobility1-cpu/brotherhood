"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import { rupees } from "@/lib/format";
import PhotoSourceTag from "./photo-source-tag";
import { confirmClaim, rejectClaim } from "@/app/payments/actions";

export default function ConfirmClaimButton({ claimId, name, amount, utr, photoUrl, wallet, path }: {
  claimId: number; name: string; amount: number; utr: string | null; photoUrl: string; wallet: number; path?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function go(yes: boolean) {
    setBusy(true); setMsg("");
    const res = yes ? await confirmClaim(claimId) : await rejectClaim(claimId, reason);
    setBusy(false);
    if (!res.ok) { setMsg(res.error); return; }
    setOpen(false); setReject(false); router.refresh();
  }

  return (
    <>
      <button className="a p" onClick={() => setOpen(true)}>Check receipt</button>
      <Modal open={open} onClose={() => !busy && setOpen(false)}>
        <h2>{name} paid {rupees(amount)}?</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photoUrl && <img src={photoUrl} alt="Payment receipt" style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />}
        <PhotoSourceTag path={path} />
        {utr && <div className="pt"><span className="mute">UPI reference</span><b>{utr}</b></div>}
        <p className="mute">Check the money has actually arrived in your bank or UPI app. Wallet {rupees(wallet)} → <b>{rupees(Number(wallet) + Number(amount))}</b>.</p>
        {reject && (<><label>Reason the rider will see</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Amount not received" /></>)}
        {msg && <p className="lerr">{msg}</p>}
        <div className="btns">
          <button className="a" onClick={() => setOpen(false)} disabled={busy}>Close</button>
          {reject
            ? <button className="a d" onClick={() => go(false)} disabled={busy}>{busy ? "Saving…" : "Yes, reject"}</button>
            : <button className="a" onClick={() => setReject(true)} disabled={busy}>Reject</button>}
          {!reject && <button className="a p" onClick={() => go(true)} disabled={busy}>{busy ? "Saving…" : "✓ Money received"}</button>}
        </div>
      </Modal>
    </>
  );
}
