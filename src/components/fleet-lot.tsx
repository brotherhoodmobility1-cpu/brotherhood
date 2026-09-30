"use client";

import { useState, type CSSProperties } from "react";
import Plate from "./plate";
import ScooterFile from "./scooter-file";

export type Bay = { id: number; code: string; rider: string | null; kind: string; label: string; chassis?: string | null };

const FILTERS: [string, string][] = [
  ["all", "All"],
  ["ok", "Running fine"],
  ["warn", "Paying late"],
  ["bad", "Needs action"],
  ["mech", "With mechanic"],
  ["free", "Available"],
];

export default function FleetLot({ bays, owner }: { bays: Bay[]; owner: boolean }) {
  const [f, setF] = useState("all");
  const [open, setOpen] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const count = (k: string) => (k === "all" ? bays.length : bays.filter((b) => b.kind === k).length);
  const shown = bays.filter((b) => (f === "all" || b.kind === f) &&
    (!q || `${b.code} ${b.rider ?? ""} ${b.chassis ?? ""}`.toLowerCase().includes(q.toLowerCase().trim())));

  return (
    <>
      <div className="chips">
        {FILTERS.map(([k, label]) => (
          <button key={k} className={`chip${f === k ? " on" : ""}`} onClick={() => setF(k)}>
            {k !== "all" && <i className={k} />}
            {label} <b>{count(k)}</b>
          </button>
        ))}
      </div>
      <input type="search" placeholder="Search scooter, rider or chassis" value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.length === 0 && <p className="mute">No scooter matches.</p>}
      <div className="lot anim" key={f + q}>
        {shown.map((b, i) => (
          <div key={b.id} className={`bay2 ${b.kind}`} role="button" tabIndex={0} onClick={() => setOpen(b.id)} style={{ cursor: "pointer" }}>
            <div className="scimg bimg" style={{ "--i": i % 40 } as CSSProperties} aria-hidden="true" />
            <span className="bi">
              <Plate code={b.code} />
              <span className="bn">{b.rider ?? "No rider"}</span>
              <span className="bs">{b.label}</span>
            </span>
          </div>
        ))}
      </div>
      {open != null && <ScooterFile scooterId={open} owner={owner} onClose={() => setOpen(null)} />}
    </>
  );
}
