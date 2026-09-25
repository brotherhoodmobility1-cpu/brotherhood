"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import Plate from "./plate";
import Empty from "./empty";
import { createClient } from "@/lib/supabase/client";
import { rupees } from "@/lib/format";
import { whenIST } from "@/lib/ist";
import { daysBetween, jobCost, type Job } from "@/lib/jobs";
import { chargeJob } from "@/app/workshop/actions";

type Scooter = { id: number; code: string; chassis_no: string | null; status: string; riders: { full_name: string; status: string }[] };

export default function MaintenanceView({ owner, jobs, scooters }: { owner: boolean; jobs: Job[]; scooters: Scooter[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hist, setHist] = useState<{ s: Scooter; urls: Record<string, string> } | null>(null);
  const [charge, setCharge] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [big, setBig] = useState("");

  const done = jobs.filter((j) => j.status === "done");
  const open = jobs.filter((j) => j.status === "open");
  const month = Date.now() - 30 * 86400000;
  const m30 = done.filter((j) => j.closed_at && Date.parse(j.closed_at) >= month);
  const avg = done.length ? (done.reduce((a, j) => a + daysBetween(j.created_at, j.closed_at!), 0) / done.length).toFixed(1) : "0";
  const perScooter = new Map<number, Job[]>();
  done.forEach((j) => perScooter.set(j.scooter_id, [...(perScooter.get(j.scooter_id) ?? []), j]));
  const most = [...perScooter.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const parts = new Map<string, { n: string; q: number; c: number }>();
  done.forEach((j) => j.job_parts.forEach((p) => {
    const k = p.name.trim().toLowerCase();
    const e = parts.get(k) ?? { n: p.name.trim(), q: 0, c: 0 };
    e.q++; e.c += Number(p.cost); parts.set(k, e);
  }));
  const partList = [...parts.values()].sort((a, b) => b.c - a.c);

  async function openHistory(s: Scooter) {
    const paths = jobs.filter((j) => j.scooter_id === s.id).flatMap((j) => j.photos);
    const urls: Record<string, string> = {};
    if (paths.length) {
      const { data } = await createClient().storage.from("job-photos").createSignedUrls(paths, 3600);
      (data ?? []).forEach((d) => { if (d.path && d.signedUrl) urls[d.path] = d.signedUrl; });
    }
    setHist({ s, urls });
  }

  const shown = scooters.filter((s) => {
    const r = s.riders.find((x) => x.status === "active");
    return !q || `${s.code} ${s.chassis_no} ${r?.full_name ?? ""}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <>
      <div className="stats">
        <div className="stat"><b>{open.length}</b><span>In workshop now</span></div>
        <div className="stat"><b>{m30.length}</b><span>Jobs done, last 30 days</span></div>
        <div className="stat"><b style={{ fontSize: 22 }}>{rupees(m30.reduce((a, j) => a + jobCost(j), 0))}</b><span>Repair cost, last 30 days</span></div>
        <div className="stat"><b style={{ fontSize: 22 }}>{avg} days</b><span>Average time in workshop</span></div>
        <div className="stat"><b style={{ fontSize: 22 }}>{most ? scooters.find((s) => s.id === most[0])?.code : "None"}</b><span>Most repairs{most ? ` · ${most[1].length} jobs` : ""}</span></div>
      </div>
      {err && <p className="lerr" role="alert">{err}</p>}

      <h2>In workshop now ({open.length})</h2>
      {open.length === 0 ? <Empty text="No scooters with the mechanic." /> : open.map((j) => (
        <div className="row" key={j.id}>
          <div className="m">
            <b>{j.scooters && <Plate code={j.scooters.code} />} · {j.ticket}</b>
            <small>{j.reason === "breakdown" ? `Breakdown${j.issue ? `: ${j.issue}` : ""}` : "Return check"} · in since {whenIST(j.created_at)} · cost so far {rupees(jobCost(j))}</small>
          </div>
          {[["Photos", j.photos.length > 0], ["Work", !!(j.work ?? "").trim()], ["Washed", j.washed]].map(([n, d]) => (
            <span key={String(n)} className={`tag ${d ? "" : "due"}`}>{d ? "✓ " : ""}{String(n)}</span>
          ))}
        </div>
      ))}

      <h2>All scooters</h2>
      <input placeholder="Search scooter, chassis or rider" value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ overflowX: "auto" }}>
        <table className="tb">
          <thead><tr><th>Scooter</th><th>Status</th><th>Rider</th><th>Last service</th><th>Jobs</th><th>Total cost</th><th /></tr></thead>
          <tbody>
            {shown.map((s) => {
              const h = perScooter.get(s.id) ?? [];
              const r = s.riders.find((x) => x.status === "active");
              return (
                <tr key={s.id}>
                  <td><Plate code={s.code} /><br /><small className="mute">{s.chassis_no}</small></td>
                  <td><span className={`tag ${s.status === "workshop" ? "due" : ""}`}>{s.status === "workshop" ? "With mechanic" : s.status === "rented" ? "Rented" : "Available"}</span></td>
                  <td>{r?.full_name ?? <span className="mute">None</span>}</td>
                  <td>{h[0]?.closed_at ? whenIST(h[0].closed_at) : <span className="mute">Never</span>}</td>
                  <td>{h.length}</td>
                  <td>{rupees(h.reduce((a, j) => a + jobCost(j), 0))}</td>
                  <td><button className="a" onClick={() => openHistory(s)}>History</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Parts used</h2>
      {partList.length === 0 ? <p className="mute">No parts used yet.</p> : (
        <div style={{ overflowX: "auto" }}>
          <table className="tb">
            <thead><tr><th>Part</th><th>Times used</th><th>Total cost</th></tr></thead>
            <tbody>{partList.map((p) => <tr key={p.n}><td>{p.n}</td><td>{p.q}</td><td>{rupees(p.c)}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      <Modal open={!!hist} onClose={() => setHist(null)}>
        {hist && (() => {
          const list = jobs.filter((j) => j.scooter_id === hist.s.id && j.status === "done");
          const active = hist.s.riders.find((x) => x.status === "active");
          return (
            <>
              <h2>{hist.s.code} service history</h2>
              <p className="mute">Chassis {hist.s.chassis_no} · {active ? `now with ${active.full_name}` : "no rider"} · {list.length} {list.length === 1 ? "job" : "jobs"} · total {rupees(list.reduce((a, j) => a + jobCost(j), 0))}</p>
              {list.length === 0 && <p className="mute">No service records yet.</p>}
              {list.map((j) => (
                <div className="row" style={{ display: "block" }} key={j.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <b>{whenIST(j.created_at)} → {j.closed_at ? whenIST(j.closed_at) : ""} · {daysBetween(j.created_at, j.closed_at!)} days</b>
                    <b>{rupees(jobCost(j))}</b>
                  </div>
                  <div className="mute">{j.ticket} · {j.reason === "breakdown" ? `Breakdown${j.issue ? `: ${j.issue}` : ""}` : "Return check"}{j.riders ? ` · rider ${j.riders.full_name}` : ""}</div>
                  <p style={{ margin: "6px 0" }}>{j.work}</p>
                  <div className="ph">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {j.photos.map((p) => hist.urls[p] && <img key={p} src={hist.urls[p]} alt="" style={{ cursor: "zoom-in" }} onClick={() => setBig(hist.urls[p])} />)}
                  </div>
                  {j.job_parts.map((p) => <div className="pt" key={p.id}><span>{p.name}</span><span>{rupees(p.cost)}</span></div>)}
                  <div className="pt"><span>Labour</span><span>{rupees(j.labour)}</span></div>
                  <div style={{ marginTop: 6 }}>
                    {j.washed && <span className="tag">✓ Washed</span>} <span className="tag">Cleared to ride</span>
                    {j.charged != null && <span className="tag due"> Charged to rider {rupees(j.charged)}</span>}
                    {owner && j.charged == null && j.reason === "breakdown" && jobCost(j) > 0 && j.riders?.status === "active" && j.riders.scooter_id === j.scooter_id && (
                      <button className="a" style={{ marginLeft: 6 }} onClick={() => setCharge(j)}>Charge rider</button>
                    )}
                  </div>
                </div>
              ))}
              <div className="btns"><button className="a p" onClick={() => setHist(null)}>Close</button></div>
            </>
          );
        })()}
      </Modal>
      <Modal open={!!charge} onClose={() => !busy && setCharge(null)}>
        {charge && (
          <>
            <h2>Charge {charge.riders?.full_name} {rupees(jobCost(charge))}?</h2>
            <p className="mute">Use this only when the damage was caused by misuse or negligence (agreement point 9). The amount is taken from the rider&apos;s wallet now.</p>
            <p>{charge.work} · {charge.ticket}</p>
            <div className="btns">
              <button className="a" onClick={() => setCharge(null)} disabled={busy}>Go back</button>
              <button className="a d" disabled={busy} onClick={async () => {
                setBusy(true);
                const res = await chargeJob(charge.id);
                setBusy(false); setCharge(null); setHist(null);
                if (!res.ok) setErr(res.error); else router.refresh();
              }}>{busy ? "Charging…" : "Yes, charge rider"}</button>
            </div>
          </>
        )}
      </Modal>
      <Modal open={!!big} onClose={() => setBig("")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={big} alt="" style={{ width: "100%", borderRadius: 8 }} />
        <div className="btns" style={{ marginTop: 10 }}><button className="a" onClick={() => setBig("")}>Close</button></div>
      </Modal>
    </>
  );
}
