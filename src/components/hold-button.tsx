"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import { setHold } from "@/app/workshop/actions";
import { perDay, rupees } from "@/lib/format";

export default function HoldButton({ riderId, name, code, issue, onHold, weeklyRent }: {
  riderId: string; name: string; code: string; issue: string | null; onHold: boolean; weeklyRent: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const h = !onHold;
  return (
    <>
      <button className={`a${onHold ? "" : " p"}`} onClick={() => setOpen(true)}>{onHold ? "Resume rent" : "Hold rent"}</button>
      <Modal open={open} onClose={() => !busy && setOpen(false)}>
        <h2>{h ? "Hold rent for " : "Resume rent for "}{name}?</h2>
        <p>{code}{issue ? ` · ${issue}` : ""}</p>
        <p className="mute">{h
          ? "No daily charge will be taken from the wallet until you resume rent or the mechanic clears the scooter to ride."
          : `The daily charge of ${rupees(perDay(weeklyRent))} will be taken again from tomorrow morning.`}</p>
        {err && <p className="lerr">{err}</p>}
        <div className="btns">
          <button className="a" onClick={() => setOpen(false)} disabled={busy}>Go back</button>
          <button className="a p" disabled={busy} onClick={async () => {
            setBusy(true);
            const res = await setHold(riderId, h);
            setBusy(false);
            if (!res.ok) { setErr(res.error); return; }
            setOpen(false); router.refresh();
          }}>{busy ? "Saving…" : h ? "Yes, hold rent" : "Yes, resume rent"}</button>
        </div>
      </Modal>
    </>
  );
}
