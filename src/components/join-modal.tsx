"use client";

import { useState, type FormEvent } from "react";
import Modal from "./modal";
import { createClient } from "@/lib/supabase/client";

export default function JoinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [area, setArea] = useState("");
  const [need, setNeed] = useState("Scooter for delivery work");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const digits = mobile.replace(/\D/g, "").slice(-10);
    if (!name.trim() || digits.length !== 10) return setErr("Enter your name and a 10-digit mobile number.");
    setBusy(true);
    const { error } = await createClient().from("enquiries").insert({
      name: name.trim(), mobile: digits, area: area.trim(), need, note: note.trim(),
    });
    setBusy(false);
    if (error) return setErr("Couldn't send right now. Please try again.");
    setSent(true);
  }

  function close() {
    setSent(false); setErr(""); setName(""); setMobile(""); setArea(""); setNote("");
    onClose();
  }

  return (
    <Modal open={open} onClose={close}>
      {sent ? (
        <div className="formok">
          <h2>Thank you, {name.trim()}</h2>
          <p>Our team will get in touch with you shortly.</p>
          <div className="btns" style={{ justifyContent: "center" }}>
            <button className="a p" onClick={close}>Close</button>
          </div>
        </div>
      ) : (
        <form onSubmit={send}>
          <h2>Join Brotherhood Mobility</h2>
          <p className="mute">Want to rent a scooter? Give your details and our team will get in touch with you shortly.</p>
          <label htmlFor="jn">Your name</label>
          <input id="jn" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="jp">Mobile number</label>
          <input id="jp" type="tel" inputMode="numeric" placeholder="10-digit mobile number" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          <label htmlFor="jc">City or area</label>
          <input id="jc" value={area} onChange={(e) => setArea(e.target.value)} />
          <label htmlFor="jw">What do you need?</label>
          <select id="jw" value={need} onChange={(e) => setNeed(e.target.value)}>
            <option>Scooter for delivery work</option>
            <option>Scooter for personal use</option>
            <option>Something else</option>
          </select>
          <label htmlFor="jt">Anything else? (optional)</label>
          <textarea id="jt" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          {err && <p className="lerr" role="alert">{err}</p>}
          <div className="btns">
            <button type="button" className="a" onClick={close}>Cancel</button>
            <button type="submit" className="a p" disabled={busy}>{busy ? "Sending…" : "Send my details"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
