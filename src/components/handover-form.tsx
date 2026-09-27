"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentPlace, stampPhoto, stampedPath } from "@/lib/stamp";
import { CHECKLIST, HANDOVER_SLOTS, handoverProblem, type HandoverInput } from "@/lib/handover";

/** Photos (4 sides + with the person), km, battery and checklist. Uploads each photo as soon as it is picked. */
export default function HandoverForm({ scooterId, code = "", toName, lockName, title, onBack, onDone, doneLabel = "Continue" }: {
  scooterId: number; code?: string; toName: string; lockName?: boolean; title: string; onBack: () => void;
  onDone: (h: HandoverInput) => void; doneLabel?: string;
}) {
  const [h, setH] = useState<HandoverInput>({ to_name: toName, photos: {}, km: null, battery: null, checklist: Object.fromEntries(CHECKLIST.map((c) => [c, true])) });
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [place, setPlace] = useState("");
  useEffect(() => { currentPlace().then(setPlace); }, []);

  async function pick(slot: string, file?: File) {
    if (!file) return;
    setBusy(slot); setErr("");
    try {
      const label = HANDOVER_SLOTS.find(([k]) => k === slot)?.[1] ?? slot;
      const blob = await stampPhoto(file, `${code ? code + " · " : ""}${label}`, place);
      const path = stampedPath(`${scooterId}/${Date.now()}-${slot}`);
      const { error } = await createClient().storage.from("handover-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setH((x) => ({ ...x, photos: { ...x.photos, [slot]: path } }));
      setPreviews((p) => ({ ...p, [slot]: URL.createObjectURL(blob) }));
    } catch { setErr("Couldn't upload that photo. Please try again."); }
    setBusy("");
  }

  return (
    <>
      <h2>{title}</h2>
      <p className="mute">Take a live photo of each side, plus one of the scooter with the person receiving it. Each photo is stamped with the date, time and location.</p>
      {HANDOVER_SLOTS.map(([k, label]) => (
        <div className="pt" key={k}>
          <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {previews[k]
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={previews[k]} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8 }} />
              : <span style={{ width: 52, height: 52, border: "1px dashed var(--mute)", borderRadius: 8, display: "inline-block", flex: "none" }} />}
            <span>{label}{busy === k ? " · uploading…" : ""}</span>
          </span>
          <label style={{ border: "1px solid var(--line)", padding: "6px 11px", borderRadius: 8, cursor: "pointer", color: "var(--ink)", fontSize: 13, fontWeight: 600, margin: 0, flex: "none" }}>
            {h.photos[k] ? "Retake" : "Take photo"}
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={!!busy} onChange={(e) => { pick(k, e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      ))}
      <label style={{ marginTop: 10 }}>Handed to</label>
      <input value={h.to_name} readOnly={lockName} onChange={(e) => setH({ ...h, to_name: e.target.value })} placeholder="Name of rider or staff member" />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}><label>Odometer (km)</label><input type="number" inputMode="numeric" value={h.km ?? ""} onChange={(e) => setH({ ...h, km: e.target.value === "" ? null : Number(e.target.value) })} /></div>
        <div style={{ flex: 1 }}><label>Battery %</label><input type="number" inputMode="numeric" value={h.battery ?? ""} onChange={(e) => setH({ ...h, battery: e.target.value === "" ? null : Number(e.target.value) })} /></div>
      </div>
      <label>Checklist</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginBottom: 10 }}>
        {CHECKLIST.map((c) => (
          <label key={c} style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--ink)", fontSize: 14, margin: 0 }}>
            <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={!!h.checklist[c]} onChange={(e) => setH({ ...h, checklist: { ...h.checklist, [c]: e.target.checked } })} />
            {c}
          </label>
        ))}
      </div>
      {err && <p className="lerr" role="alert">{err}</p>}
      <div className="btns">
        <button className="a" onClick={onBack} disabled={!!busy}>Back</button>
        <button className="a p" disabled={!!busy} onClick={() => { const p = handoverProblem(h); if (p) setErr(p); else onDone(h); }}>{doneLabel}</button>
      </div>
    </>
  );
}
