"use client";

import { useState } from "react";
import Modal from "./modal";

export type Cred = { name: string; mobile: string; password: string; note?: string };

export default function CredModal({ cred, onClose }: { cred: Cred | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!cred) return null;
  const msg = `Brotherhood Mobility login\nMobile: ${cred.mobile}\nPassword: ${cred.password}\nYou will set your own password when you first log in.\nOpen: https://app.brotherhoodmobility.in`;
  return (
    <Modal open onClose={onClose}>
      <h2>Login details for {cred.name}</h2>
      <div className="pt"><span className="mute">Mobile number</span><b>{cred.mobile}</b></div>
      <div className="pt"><span className="mute">Temporary password</span><b className="tpw">{cred.password}</b></div>
      <p className="mute">
        {cred.note ? cred.note + " " : ""}Share these with {cred.name}. The password is shown only now, and they must choose their own password when they first log in.
      </p>
      <div className="btns">
        <button className="a" onClick={async () => {
          try { await navigator.clipboard.writeText(cred.password); setCopied(true); } catch { setCopied(false); }
        }}>{copied ? "Copied" : "Copy password"}</button>
        <a className="a" style={{ textDecoration: "none", padding: "8px 13px", border: "1.5px solid var(--line)", borderRadius: 10 }}
          href={`https://wa.me/91${cred.mobile}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>
        <button className="a p" onClick={() => { setCopied(false); onClose(); }}>Done</button>
      </div>
    </Modal>
  );
}
