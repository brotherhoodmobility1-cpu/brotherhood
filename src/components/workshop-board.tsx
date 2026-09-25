"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import Plate from "./plate";
import Empty from "./empty";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { rupees } from "@/lib/format";
import { whenIST } from "@/lib/ist";
import { jobCost, type Job } from "@/lib/jobs";
import { clearJob } from "@/app/workshop/actions";

function JobInfo({ j }: { j: Job }) {
  return (
    <>
      <div className="mute" style={{ marginTop: 4 }}>
        {j.reason === "breakdown" ? "Breakdown" : "Return check"}
        {j.issue ? <>: <b style={{ color: "var(--ink)" }}>{j.issue}</b></> : null}
        {" · "}{j.ticket} · in since {whenIST(j.created_at)}
        {j.riders && j.reason === "breakdown" ? ` · rider ${j.riders.full_name}` : ""}
      </div>
      {j.note && <p style={{ margin: "6px 0" }}>Rider says: &quot;{j.note}&quot;</p>}
      {j.lat != null && j.lng != null && (
        <a className="tag" href={`https://www.google.com/maps?q=${j.lat},${j.lng}`} target="_blank" rel="noopener noreferrer">Open breakdown location</a>
      )}
    </>
  );
}

function Card({ j, urls }: { j: Job; urls: Record<string, string> }) {
  const router = useRouter();
  const [work, setWork] = useState(j.work ?? "");
  const [labour, setLabour] = useState(String(Number(j.labour) || ""));
  const [pn, setPn] = useState("");
  const [pc, setPc] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [ask, setAsk] = useState(false);
  const [big, setBig] = useState("");
  const supabase = createClient();

  async function update(v: Record<string, unknown>) {
    const { error } = await supabase.from("jobs").update(v).eq("id", j.id);
    if (error) setErr("Couldn't save. Please try again."); else { setErr(""); router.refresh(); }
  }
  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setBusy("photos");
    try {
      const added: string[] = [];
      for (const f of Array.from(files)) {
        const blob = await compressImage(f);
        const path = `${j.id}/${Date.now()}-${added.length}.jpg`;
        const { error } = await supabase.storage.from("job-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        added.push(path);
      }
      await update({ photos: [...j.photos, ...added] });
    } catch { setErr("Couldn't upload the photo."); }
    setBusy("");
  }
  async function addPart() {
    const cost = Number(pc);
    if (!pn.trim() || pc === "" || cost < 0) { setErr("Enter the part name and its cost."); return; }
    const { error } = await supabase.from("job_parts").insert({ job_id: j.id, name: pn.trim(), cost });
    if (error) { setErr("Couldn't add the part."); return; }
    setPn(""); setPc(""); setErr(""); router.refresh();
  }
  async function removePart(id: number) {
    await supabase.from("job_parts").delete().eq("id", id);
    router.refresh();
  }
  const steps: [string, boolean][] = [["Photos", j.photos.length > 0], ["Work notes", !!(j.work ?? "").trim()], ["Washed", j.washed]];

  return (
    <div className="row" style={{ display: "block" }}>
      <b>{j.scooters && <Plate code={j.scooters.code} />} · chassis {j.scooters?.chassis_no ?? "–"}</b>
      <JobInfo j={j} />
      <div style={{ margin: "8px 0" }}>
        {steps.map(([n, d]) => <span key={n} className={`tag ${d ? "" : "due"}`} style={{ marginRight: 4 }}>{d ? "✓ " : ""}{n}</span>)}
        <span className="tag" style={{ background: "transparent", color: "var(--mute)" }}>{j.job_parts.length} parts</span>
      </div>

      <div className="mute">Photos on arrival ({j.photos.length})</div>
      <div className="ph">
        {j.photos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p} src={urls[p]} alt="" onClick={() => setBig(urls[p])} style={{ cursor: "zoom-in" }} />
        ))}
      </div>
      <label style={{ display: "inline-block", border: "1px solid var(--line)", padding: "6px 11px", borderRadius: 8, cursor: "pointer", color: "var(--ink)", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
        {busy === "photos" ? "Uploading…" : "+ Add photos"}
        <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} disabled={!!busy} onChange={(e) => addPhotos(e.target.files)} />
      </label>

      <label>Work done and what was changed</label>
      <textarea rows={3} value={work} onChange={(e) => setWork(e.target.value)} onBlur={() => work !== (j.work ?? "") && update({ work })} />

      <label>Spare parts and cost</label>
      {j.job_parts.map((p) => (
        <div className="pt" key={p.id}><span>{p.name}</span><b>{rupees(p.cost)}</b><button className="a" onClick={() => removePart(p.id)}>Remove</button></div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input placeholder="Part name" value={pn} onChange={(e) => setPn(e.target.value)} />
        <input type="number" placeholder="Cost ₹" value={pc} onChange={(e) => setPc(e.target.value)} style={{ maxWidth: 110 }} />
        <button className="a p" style={{ height: 44 }} onClick={addPart}>Add</button>
      </div>
      <label>Labour charge (₹)</label>
      <input type="number" placeholder="0" value={labour} onChange={(e) => setLabour(e.target.value)}
        onBlur={() => Number(labour || 0) !== Number(j.labour) && update({ labour: Number(labour || 0) })} />
      <p><b>Parts {rupees(j.job_parts.reduce((a, p) => a + Number(p.cost), 0))} · labour {rupees(j.labour)} · total {rupees(jobCost(j))}</b></p>

      <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink)", fontSize: 14 }}>
        <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={j.washed} onChange={(e) => update({ washed: e.target.checked })} />
        Scooter washed and cleaned
      </label>
      {err && <p className="lerr" role="alert">{err}</p>}
      <button className="a p" style={{ width: "100%", marginTop: 10 }} onClick={() => {
        const miss = [!j.photos.length && "add photos of the scooter", !(j.work ?? "").trim() && "write the work done", !j.washed && "tick that it is washed"].filter(Boolean);
        if (miss.length) { setErr(`Before clearing: ${miss.join(", ")}.`); return; }
        setErr(""); setAsk(true);
      }}>Clear to ride</button>

      <Modal open={ask} onClose={() => !busy && setAsk(false)}>
        <h2>Clear {j.scooters?.code} to ride?</h2>
        <p className="mute">The scooter goes back {j.riders?.status === "active" && j.riders.scooter_id === j.scooter_id ? `to ${j.riders.full_name}` : "to available scooters"}, and the job moves to repair history.</p>
        <p>{j.work}</p>
        <p><b>Total {rupees(jobCost(j))}</b> · {j.photos.length} photos</p>
        <div className="btns">
          <button className="a" onClick={() => setAsk(false)} disabled={!!busy}>Go back</button>
          <button className="a p" disabled={!!busy} onClick={async () => {
            setBusy("clear");
            const res = await clearJob(j.id);
            setBusy(""); setAsk(false);
            if (!res.ok) setErr(res.error); else router.refresh();
          }}>{busy === "clear" ? "Saving…" : "Yes, clear to ride"}</button>
        </div>
      </Modal>
      <Modal open={!!big} onClose={() => setBig("")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={big} alt="" style={{ width: "100%", borderRadius: 8 }} />
        <div className="btns" style={{ marginTop: 10 }}><button className="a" onClick={() => setBig("")}>Close</button></div>
      </Modal>
    </div>
  );
}

export default function WorkshopBoard({ jobs, done, urls }: { jobs: Job[]; done: Job[]; urls: Record<string, string> }) {
  return (
    <>
      <h2>Scooters in workshop ({jobs.length})</h2>
      {jobs.length === 0 ? <Empty text="No scooters waiting. Breakdowns reported by riders appear here." /> : jobs.map((j) => <Card key={j.id} j={j} urls={urls} />)}
      <h2>Repair history ({done.length})</h2>
      {done.length === 0 ? <p className="mute">Finished jobs will be listed here with parts and cost.</p> : done.map((j) => (
        <div className="row" style={{ display: "block" }} key={j.id}>
          <b>{j.scooters && <Plate code={j.scooters.code} />} · {j.closed_at ? whenIST(j.closed_at) : ""}</b> <span className="tag">Clear to ride</span>
          <p style={{ margin: "6px 0" }}>{j.work}</p>
          <div className="mute">
            {j.job_parts.length ? j.job_parts.map((p) => `${p.name} ${rupees(p.cost)}`).join(", ") : "No spare parts"} · labour {rupees(j.labour)} · total {rupees(jobCost(j))} · {j.photos.length} photos
          </div>
        </div>
      ))}
    </>
  );
}
