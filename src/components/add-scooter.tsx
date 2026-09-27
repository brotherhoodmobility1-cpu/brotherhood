"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import { addScooter } from "@/app/passport/actions";

export default function AddScooter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ chassis_no: "", motor_no: "", model: "", reg_no: "", purchase_date: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  return (
    <>
      <button className="a p" onClick={() => { setErr(""); setDone(""); setOpen(true); }}>+ Add scooter</button>
      <Modal open={open} onClose={() => !busy && setOpen(false)}>
        {done ? (
          <div className="okm">
            <div className="okc"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
            <h2>{done} added</h2>
            <p>It now appears in Fleet and Scooter Passport, and can be allotted to a rider.</p>
            <div className="btns" style={{ justifyContent: "center" }}><button className="a p" onClick={() => setOpen(false)}>Okay</button></div>
          </div>
        ) : (
          <>
            <h2>Add a new scooter</h2>
            <p className="mute">The next MOTO number is given automatically.</p>
            <label>Chassis no.</label><input value={v.chassis_no} onChange={(e) => setV({ ...v, chassis_no: e.target.value })} />
            <label>Motor no. (optional)</label><input value={v.motor_no} onChange={(e) => setV({ ...v, motor_no: e.target.value })} />
            <label>Model (optional)</label><input value={v.model} onChange={(e) => setV({ ...v, model: e.target.value })} />
            <label>Number plate (optional)</label><input value={v.reg_no} onChange={(e) => setV({ ...v, reg_no: e.target.value })} />
            <label>Bought on (optional)</label><input type="date" value={v.purchase_date} onChange={(e) => setV({ ...v, purchase_date: e.target.value })} />
            {err && <p className="lerr" role="alert">{err}</p>}
            <div className="btns">
              <button className="a" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button className="a p" disabled={busy} onClick={async () => {
                setBusy(true);
                const res = await addScooter(v);
                setBusy(false);
                if (!res.ok) { setErr(res.error); return; }
                setDone(res.code ?? "Scooter"); setV({ chassis_no: "", motor_no: "", model: "", reg_no: "", purchase_date: "" });
                router.refresh();
              }}>{busy ? "Saving…" : "Add scooter"}</button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
