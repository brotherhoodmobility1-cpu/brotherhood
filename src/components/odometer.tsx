"use client";

import { useEffect, useState, type CSSProperties } from "react";

export default function Odometer({ value }: { value: string }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGo(true), 60);
    return () => clearTimeout(t);
  }, []);
  return (
    <span aria-label={value}>
      {value.split("").map((c, i) =>
        /\d/.test(c) ? (
          <span key={i} className="dg" aria-hidden="true">
            <span className="dr" style={{ "--d": go ? Number(c) : 0 } as CSSProperties}>
              {"0123456789".split("").map((n) => <span key={n}>{n}</span>)}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true">{c}</span>
        )
      )}
    </span>
  );
}
