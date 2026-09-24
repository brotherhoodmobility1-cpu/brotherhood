"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import Icon from "./icons";
import Odometer from "./odometer";

type Odo = { label: string; value: string; tone?: "" | "warm" | "hot" };
type Lamp = { icon: string; label: string; n: number; color: string; href: string };

const L = 251.3;

function ticks() {
  const out = [];
  for (let i = 0; i <= 10; i++) {
    const an = Math.PI * (1 - i / 10);
    const c = Math.cos(an), s = Math.sin(an), r1 = i % 5 ? 86 : 83;
    out.push(
      <line key={i} x1={100 + c * r1} y1={108 - s * r1} x2={100 + c * 92} y2={108 - s * 92}
        stroke={i % 5 ? "#46534e" : "#9fb0a8"} strokeWidth={i % 5 ? 1.5 : 2.5} />
    );
  }
  return out;
}

export default function Cockpit({ pct, gaugeLabel, odos, lamps }: { pct: number; gaugeLabel: string; odos: Odo[]; lamps: Lamp[] }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGo(true), 60);
    return () => clearTimeout(t);
  }, []);
  const p = Math.max(0, Math.min(1, pct));

  return (
    <div className="cock">
      <div className="gauge">
        <svg viewBox="0 0 200 122" aria-hidden="true">
          <defs>
            <linearGradient id="gArc" x1="0" x2="1">
              <stop offset="0" stopColor="#c62828" />
              <stop offset=".45" stopColor="#f2b705" />
              <stop offset="1" stopColor="#3dbe78" />
            </linearGradient>
          </defs>
          <path d="M20 108A80 80 0 0 1 180 108" fill="none" stroke="#1f2926" strokeWidth="12" strokeLinecap="round" />
          <path className="arc" d="M20 108A80 80 0 0 1 180 108" fill="none" stroke="url(#gArc)" strokeWidth="12"
            strokeLinecap="round" strokeDasharray={L} strokeDashoffset={go ? L * (1 - p) : L} />
          {ticks()}
          <text x="14" y="121" fill="#6f7d77" fontSize="9">0</text>
          <text x="178" y="121" fill="#6f7d77" fontSize="9">100</text>
          <g className="needle" style={{ transform: `rotate(${go ? -90 + 180 * p : -90}deg)` }}>
            <path d="M100 108 97 104 100 34 103 104z" fill="#f2b705" />
          </g>
          <circle cx="100" cy="108" r="7" fill="#0e1412" stroke="#f2b705" strokeWidth="2.5" />
        </svg>
        <div className="gv"><Odometer value={`${Math.round(p * 100)}%`} /></div>
        <div className="gl">{gaugeLabel}</div>
      </div>
      <div className="odos">
        {odos.map((o) => (
          <div className="od" key={o.label}>
            <small>{o.label}</small>
            <b className={o.tone || ""}><Odometer value={o.value} /></b>
          </div>
        ))}
      </div>
      <div className="lamps">
        {lamps.map((l) => {
          const inner = (
            <>
              <i><Icon name={l.icon} /></i>
              {l.label} <b>{l.n}</b>
            </>
          );
          return l.n > 0 ? (
            <Link key={l.label} href={l.href} className="lamp on" style={{ "--lc": l.color } as CSSProperties}>{inner}</Link>
          ) : (
            <span key={l.label} className="lamp" style={{ "--lc": l.color } as CSSProperties}>{inner}</span>
          );
        })}
      </div>
    </div>
  );
}
