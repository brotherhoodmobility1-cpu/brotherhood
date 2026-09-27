"use client";

import { useState } from "react";
import Modal from "./modal";
import { formatDate, nextDue, rupees } from "@/lib/format";

export type WaRider = { name: string; mobile: string | null; code: string; weeklyRent: number; wallet: number; startDate: string | null; chassis?: string | null };

/** Amount that puts one full week's rent in the wallet (also clears any minus). */
export const amountDue = (r: WaRider) => Math.max(0, Math.round(Number(r.weeklyRent) - Number(r.wallet)));

export default function WhatsAppButton({ r, qrUrl, upiId, compact, kind = "reminder" }: { r: WaRider; qrUrl: string | null; upiId: string; compact?: boolean; kind?: "reminder" | "due" }) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState(String(kind === "due" ? Math.round(Number(r.weeklyRent)) : amountDue(r) || Math.round(Number(r.weeklyRent))));
  const [note, setNote] = useState("");
  if (!r.mobile) return null;

  const due = nextDue(r.startDate);
  const a = rupees(Number(amt) || 0);
  const msg = kind === "due"
    ? `Hello ${r.name},\n` +
      `This is Brotherhood Mobility.\n` +
      `Scooter: ${r.code}${r.chassis ? ` · Chassis: ${r.chassis}` : ""}\n\n` +
      `Today is your weekly payment day. Kindly pay your weekly rent of ${a} and recharge your wallet.\n` +
      `Please pay using the QR code attached${upiId ? ` or to UPI ID ${upiId}` : ""}.\n` +
      `After paying, please upload the payment receipt in the Brotherhood Mobility app (Payments → Upload payment receipt), or share the screenshot with us here on WhatsApp.\n` +
      `Thank you for riding with Brotherhood Mobility!\n\n` +
      `हैलो ${r.name},\n` +
      `यह ब्रदरहुड मोबिलिटी की ओर से संदेश है।\n` +
      `स्कूटर: ${r.code}${r.chassis ? ` · चेसिस: ${r.chassis}` : ""}\n\n` +
      `आज आपके साप्ताहिक भुगतान का दिन है। कृपया ${a} का साप्ताहिक किराया जमा करें और अपना वॉलेट रिचार्ज करें।\n` +
      `कृपया साथ भेजे गए QR कोड से भुगतान करें। भुगतान के बाद ऐप में रसीद अपलोड करें या इसी WhatsApp पर स्क्रीनशॉट भेज दें।\n` +
      `ब्रदरहुड मोबिलिटी के साथ चलने के लिए आपका धन्यवाद!`
    : `Hello ${r.name},\n` +
      `This is Brotherhood Mobility.\n` +
      `Scooter: ${r.code}${r.chassis ? ` · Chassis: ${r.chassis}` : ""}\n\n` +
      `Your payment of ${a} is pending${due ? `. Your next rent day is ${formatDate(due)}` : ""}.\n` +
      `Please pay using the QR code attached${upiId ? ` or to UPI ID ${upiId}` : ""}, then upload the payment receipt in the Brotherhood Mobility app or share the screenshot with us here on WhatsApp.\n` +
      `Thank you!\n\n` +
      `हैलो ${r.name},\n` +
      `स्कूटर ${r.code} का ${a} भुगतान बाकी है। कृपया साथ भेजे गए QR कोड से भुगतान करें और ऐप में रसीद अपलोड करें या इसी WhatsApp पर स्क्रीनशॉट भेज दें। धन्यवाद!`;

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
        : "This device can't attach the picture directly. Tap Save QR image, then Text only, and attach the saved QR in WhatsApp.");
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
        <h2>{kind === "due" ? "Payment day message to" : "Payment reminder to"} {r.name}</h2>
        <p className="mute">{r.code} · wallet {rupees(r.wallet)} · weekly rent {rupees(r.weeklyRent)}</p>
        <label>Amount to ask for (₹)</label>
        <input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <label>Message</label>
        <textarea rows={kind === "due" ? 12 : 8} readOnly value={msg} style={{ fontSize: 13.5 }} />
        {note && <p className="lerr">{note}</p>}
        <div className="btns">
          <button className="a" onClick={() => setOpen(false)}>Cancel</button>
          {qrUrl && <a className="a" href={qrUrl} download="brotherhood-payment-qr.jpg" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", padding: "8px 13px", border: "1.5px solid var(--line)", borderRadius: 10 }}>Save QR image</a>}
          <a className="a" style={{ textDecoration: "none", padding: "8px 13px", border: "1.5px solid var(--line)", borderRadius: 10 }}
            href={`https://wa.me/91${r.mobile}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">Text only</a>
          <button className="a p" onClick={shareWithImage}>Send on WhatsApp with QR</button>
        </div>
        <p className="note">
          <b>Send on WhatsApp with QR</b> attaches your QR code picture with this message: choose WhatsApp, then {r.name}, then Send.
          If your device can&apos;t attach pictures, use <b>Text only</b> and attach the QR with <b>Save QR image</b>.
        </p>
      </Modal>
    </>
  );
}
