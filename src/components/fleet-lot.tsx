"use client";

import { useState, type CSSProperties } from "react";
import Plate from "./plate";

export type Bay = { id: number; code: string; rider: string | null; kind: string; label: string };

const FILTERS: [string, string][] = [
  ["all", "All"],
  ["ok", "Running fine"],
  ["warn", "Low or late"],
  ["bad", "Needs action"],
  ["mech", "With mechanic"],
  ["free", "Available"],
];

export default function FleetLot({ bays }: { bays: Bay[] }) {
  const [f, setF] = useState("all");
  const count = (k: string) => (k === "all" ? bays.length : bays.filter((b) => b.kind === k).length);
  const shown = bays.filter((b) => f === "all" || b.kind === f);

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
      <div className="lot anim" key={f}>
        {shown.map((b, i) => (
          <div key={b.id} className={`bay2 ${b.kind}`}>
            <div className="scimg bimg" style={{ "--i": i % 40 } as CSSProperties} aria-hidden="true" />
            <span className="bi">
              <Plate code={b.code} />
              <span className="bn">{b.rider ?? "No rider"}</span>
              <span className="bs">{b.label}</span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
