"use client";

import { useState } from "react";
import Plate from "./plate";
import ScooterFile from "./scooter-file";
import { formatDate } from "@/lib/format";
import { INSURANCE_SOON, SWAP_SOON, daysLeft, expiryTag, type SwapPlan } from "@/lib/passport";

export type PassportRow = {
  id: number; code: string; chassis: string | null; reg: string | null; insuranceTo: string | null;
  rider: string | null; plan: SwapPlan | null; papers: number;
};

const F: [string, string][] = [["all", "All"], ["swap", "Swap plan ending or expired"], ["noplan", "No swap plan"], ["ins", "Insurance ending or missing"]];

export default function PassportList({ rows, owner }: { rows: PassportRow[]; owner: boolean }) {
  const [f, setF] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const swapBad = (r: PassportRow) => !!r.plan && (daysLeft(r.plan.ends_on) ?? 99) <= SWAP_SOON;
  const insBad = (r: PassportRow) => (daysLeft(r.insuranceTo) ?? -1) <= INSURANCE_SOON;
  const match = (r: PassportRow) =>
    (f === "all" || (f === "swap" && swapBad(r)) || (f === "noplan" && !r.plan) || (f === "ins" && insBad(r))) &&
    (!q || `${r.code} ${r.chassis ?? ""} ${r.reg ?? ""} ${r.rider ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const count = (k: string) => rows.filter((r) => k === "all" || (k === "swap" && swapBad(r)) || (k === "noplan" && !r.plan) || (k === "ins" && insBad(r))).length;
  const shown = rows.filter(match).sort((a, b) => (daysLeft(a.plan?.ends_on ?? null) ?? 9999) - (daysLeft(b.plan?.ends_on ?? null) ?? 9999));

  return (
    <>
      <div className="chips">
        {F.map(([k, l]) => <button key={k} className={`chip${f === k ? " on" : ""}`} onClick={() => setF(k)}>{l} <b>{count(k)}</b></button>)}
      </div>
      <input placeholder="Search scooter, chassis, number plate or rider" value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ overflowX: "auto" }}>
        <table className="tb">
          <thead><tr><th>Scooter</th><th>Rider</th><th>Battery swap plan</th><th>Insurance</th><th>Papers</th><th /></tr></thead>
          <tbody>
            {shown.map((r) => {
              const st = expiryTag(r.plan?.ends_on ?? null, SWAP_SOON);
              const it = expiryTag(r.insuranceTo, INSURANCE_SOON);
              return (
                <tr key={r.id}>
                  <td><Plate code={r.code} /><br /><small className="mute">Chassis {r.chassis ?? "–"}{r.reg ? ` · ${r.reg}` : ""}</small></td>
                  <td>{r.rider ?? <span className="mute">None</span>}</td>
                  <td>
                    {r.plan ? (
                      <>
                        <span className={`tag ${st[0]}`}>{st[1]}</span><br />
                        <small className="mute">{formatDate(r.plan.starts_on)} → {formatDate(r.plan.ends_on)}
                          {r.plan.swaps_total != null ? ` · ${r.plan.swaps_used}/${r.plan.swaps_total} swaps` : ""}{r.plan.kwh != null ? ` · ${r.plan.kwh} kWh` : ""}</small>
                      </>
                    ) : <span className="tag due">No plan</span>}
                  </td>
                  <td><span className={`tag ${it[0]}`}>{r.insuranceTo ? it[1] : "Not added"}</span>{r.insuranceTo ? <><br /><small className="mute">till {formatDate(r.insuranceTo)}</small></> : null}</td>
                  <td>{r.papers}</td>
                  <td><button className="a" onClick={() => setOpen(r.id)}>Open</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open != null && <ScooterFile scooterId={open} owner={owner} onClose={() => setOpen(null)} />}
    </>
  );
}
