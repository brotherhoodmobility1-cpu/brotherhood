"use client";

import { useState } from "react";
import Modal from "./modal";
import { formatDate, nextDue, rupees } from "@/lib/format";

export type WaRider = { name: string; mobile: string | null; code: string; weeklyRent: number; wallet: number; startDate: string | null };

/** Amount that puts one full week's rent in the wallet (also clears any minus). */
export const amountDue = (r: WaRider) => Math.max(0, Math.round(Number(r.weeklyRent) - Number(r.wallet)));

export default function WhatsAppButton({ r, qrUrl, upiId, compact }: { r: WaRider; qrUrl: string | null; upiId: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState(String(amountDue(r) || Math.round(Number(r.weeklyRent))));
  const [note, setNote] = useState("");
  if (!r.mobile) return null;

  const first = r.name.split(" ")[0];
  const due = nextDue(r.startDate);
  const a = rupees(Number(amt) || 0);
  const msg =
    `Namaste ${first}, this is Brotherhood Mobility.\n` +
    `Your payment of ${a} for scooter ${r.code} is due${due ? ` by ${formatDate(due)}` : ""}.\n` +
    `Please pay by scanning our QR code${upiId ? ` or to UPI ID ${upiId}` : ""}, then upload the payment receipt in the app: https://app.brotherhoodmobility.in\n` +
    (qrUrl ? `QR code: ${qrUrl}\n` : "") +
    `\nनमस्ते ${first}, स्कूटर ${r.code} का ${a} भुगतान${due ? ` ${formatDate(due)} तक` : ""} करें। QR स्कैन करके भुगतान करें और ऐप में रसीद अपलोड करें। धन्यवाद!`;

  async function shareWithImage() {
    setNote("");
    try {
      if (!qrUrl) throw new Error("no-qr");
      const blob = await (await fetch(qrUrl)).blob();
      const file = new File([blob], "brotherhood-payment-qr.jpg", { type: blob.type || "image/jpeg" });
      if (!navigator.canShare?.({ files: [file] })) throw new Error("no-share");
      await navigator.share({ files: [file], text: msg });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setNote(e instanceof Error && e.message === "no-qr"
        ? "Upload your QR code in Payments first."
        : "This device can't attach the image directly. Use Open WhatsApp instead; the message includes a link to your QR code.");
    }
  }

  return (
    <>
      <button className="a" onClick={() => setOpen(true)} aria-label={`WhatsApp ${r.name}`}
        style={{ color: "#128c4b", borderColor: "#128c4b", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5z" />
          <path d="M9 9.5c.3 1.8 2 3.8 4.5 4.5l1-1.2 1.7.8" />
        </svg>
        {!compact && "WhatsApp"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <h2>Payment reminder to {r.name}</h2>
        <p className="mute">{r.code} · wallet {rupees(r.wallet)} · weekly rent {rupees(r.weeklyRent)}</p>
        <label>Amount to ask for (₹)</label>
        <input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <label>Message</label>
        <textarea rows={8} readOnly value={msg} style={{ fontSize: 13.5 }} />
        {note && <p className="lerr">{note}</p>}
        <div className="btns">
          <button className="a" onClick={() => setOpen(false)}>Cancel</button>
          <button className="a" onClick={shareWithImage}>Share with QR image</button>
          <a className="a p" style={{ textDecoration: "none", padding: "8px 13px", borderRadius: 10, background: "var(--plate)", color: "#fff" }}
            href={`https://wa.me/91${r.mobile}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer"
            onClick={() => setOpen(false)}>Open WhatsApp</a>
        </div>
        <p className="note">Open WhatsApp starts a chat with {r.name} with this message ready to send. Share with QR image (on phones) attaches the QR photo itself; then choose WhatsApp and {r.name}.</p>
      </Modal>
    </>
  );
}
