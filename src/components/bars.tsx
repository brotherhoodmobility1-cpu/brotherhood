import type { CSSProperties } from "react";
import { rupees } from "@/lib/format";

type Series = { name: string; color: string };

export default function Bars({ rows, series }: { rows: { label: string; values: number[] }[]; series: Series[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => r.values));
  let i = 0;
  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, minWidth: rows.length * 38, paddingTop: 10 }}>
          {rows.map((r) => (
            <div key={r.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 32 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 140, width: "100%", justifyContent: "center" }}>
                {r.values.map((v, k) => (
                  <div key={k} className="bar" title={`${series[k].name} ${rupees(v)}`}
                    style={{ width: series.length > 1 ? "42%" : "72%", height: v ? Math.max(3, Math.round((v / max) * 140)) : 0,
                      background: series[k].color, borderRadius: "4px 4px 0 0", "--i": i++ } as CSSProperties} />
                ))}
              </div>
              <small className="mute" style={{ fontSize: 11, marginTop: 4, whiteSpace: "nowrap" }}>{r.label}</small>
            </div>
          ))}
        </div>
      </div>
      {series.length > 1 && (
        <p className="mute" style={{ fontSize: 12.5 }}>
          {series.map((s) => (
            <span key={s.name}><span style={{ display: "inline-block", width: 10, height: 10, background: s.color, borderRadius: 2, margin: "0 5px 0 10px" }} />{s.name}</span>
          ))}
        </p>
      )}
    </>
  );
}
