"use client";

import type { ReactNode } from "react";
import Modal from "./modal";
import { rupees } from "@/lib/format";
import { whenIST } from "@/lib/ist";

export type Receipt = {
  receipt_no: string; amount: number; method: string; razorpay_payment_id: string | null; utr?: string | null; paid_at: string;
  rider?: string; code?: string;
};

export { whenIST };

export default function ReceiptModal({ r, onClose }: { r: Receipt | null; onClose: () => void }) {
  if (!r) return null;
  const row = (a: string, b: ReactNode) => <div className="pt"><span className="mute">{a}</span><b>{b}</b></div>;
  return (
    <Modal open onClose={onClose}>
      <h2>Payment receipt</h2>
      <p className="mute">Brotherhood Mobility · wallet payment</p>
      {row("Receipt no.", r.receipt_no)}
      {row(r.method === "upi" ? "UPI reference" : "Payment ID", <code>{r.razorpay_payment_id ?? r.utr ?? (r.method === "cash" ? "Cash" : "–")}</code>)}
      {row("Date and time", whenIST(r.paid_at))}
      {r.rider && row("Rider", r.rider)}
      {r.code && row("Scooter", r.code)}
      {row("Amount", rupees(r.amount))}
      {row("Paid by", r.method === "cash" ? "Cash" : r.method === "upi" ? "UPI (QR code)" : "UPI / Razorpay")}
      {row("Status", <span style={{ color: "var(--ev)" }}>Successful</span>)}
      <div className="btns" style={{ marginTop: 12 }}><button className="a p" onClick={onClose}>Close</button></div>
    </Modal>
  );
}
