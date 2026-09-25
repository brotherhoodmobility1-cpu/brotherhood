"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import Plate from "./plate";
import { saveHub } from "@/app/live-map/actions";

export type Spot = { id: string; name: string; mobile: string | null; code: string; loc: { lat: number; lng: number; accuracy: number | null; updated_at: string } | null };

const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};
function state(s: Spot): ["live" | "stale" | "off", string] {
  if (!s.loc) return ["off", "Not shared yet"];
  const m = (Date.now() - Date.parse(s.loc.updated_at)) / 60000;
  if (m <= 15) return ["live", "Live"];
  if (m <= 120) return ["stale", `Last seen ${ago(s.loc.updated_at)}`];
  return ["off", "Location off"];
}
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const p = Math.PI / 180, dl = (b.lat - a.lat) * p, dg = (b.lng - a.lng) * p;
  const x = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(dg / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

export default function LiveRadar({ owner, spots, hub }: { owner: boolean; spots: Spot[]; hub: { lat: number; lng: number; set: boolean } }) {
  const router = useRouter();
  const [info, setInfo] = useState<Spot | null>(null);
  const [hubOpen, setHubOpen] = useState(false);
  const [hubText, setHubText] = useState(`${hub.lat}, ${hub.lng}`);
  const [err, setErr] = useState("");
  const c = { live: 0, stale: 0, off: 0 };
  spots.forEach((s) => c[state(s)[0]]++);
  const MX = 15, SC = 140 / MX;
  const order = { off: 0, stale: 1, live: 2 };
  const rows = [...spots].sort((a, b) => order[state(a)[0]] - order[state(b)[0]]);

  return (
    <>
      <div className="chips">
        <span className="chip"><i className="ok" />Live now <b>{c.live}</b></span>
        <span className="chip"><i className="warn" />Not updated recently <b>{c.stale}</b></span>
        <span className="chip"><i className="bad" />Location off <b>{c.off}</b></span>
        {owner && <button className="chip" onClick={() => setHubOpen(true)}>Set hub location</button>}
        <button className="chip" onClick={() => router.refresh()}>Refresh</button>
      </div>
      {!hub.set && owner && <p className="mute">Set your hub (office or yard) so distances are measured from the right place.</p>}
      <div className="radarw">
        <svg className="radar" viewBox="0 0 320 320" aria-label="Rider locations around your hub">
          <defs>
            <radialGradient id="rg"><stop offset="0" stopColor="#1e2a25" /><stop offset="1" stopColor="#070a09" /></radialGradient>
            <linearGradient id="sw" x1="0" x2="1"><stop offset="0" stopColor="#3dbe78" stopOpacity="0" /><stop offset="1" stopColor="#3dbe78" stopOpacity=".35" /></linearGradient>
          </defs>
          <circle cx="160" cy="160" r="150" fill="url(#rg)" />
          {[5, 10, 15].map((k) => (
            <g key={k}>
              <circle cx="160" cy="160" r={k * SC} fill="none" stroke="#26312d" />
              <text x={163 + k * SC * 0.7} y={157 - k * SC * 0.7} className="rl">{k} km</text>
            </g>
          ))}
          <path d="M160 10V310M10 160H310" stroke="#1d2622" />
          <g className="sweep"><path d="M160 160 L160 10 A150 150 0 0 1 266 54 Z" fill="url(#sw)" /></g>
          {spots.filter((s) => s.loc).map((s) => {
            const dx = (s.loc!.lng - hub.lng) * 111.32 * Math.cos((hub.lat * Math.PI) / 180), dy = (s.loc!.lat - hub.lat) * 110.57;
            const d = Math.hypot(dx, dy), k = d > MX ? MX / d : 1, x = 160 + dx * k * SC, y = 160 - dy * k * SC, st = state(s)[0];
            return (
              <g key={s.id} className={`dot ${st}`} role="button" tabIndex={0} onClick={() => setInfo(s)}>
                <circle cx={x} cy={y} r="6.5" />
                {st === "live" && <circle className="ping" cx={x} cy={y} r="6.5" />}
                <text x={x + 9} y={y + 4}>{s.code.replace("MOTO-", "")}</text>
              </g>
            );
          })}
          <circle cx="160" cy="160" r="8" fill="#f2b705" />
          <text x="160" y="182" className="hub">Hub</text>
        </svg>
        <p className="mute" style={{ textAlign: "center", margin: "6px 0 0" }}>Tap a dot for details. Riders further than 15 km show at the edge.</p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="tb">
          <thead><tr><th>Rider</th><th>Status</th><th>Distance</th><th /></tr></thead>
          <tbody>
            {rows.map((s) => {
              const x = state(s);
              return (
                <tr key={s.id}>
                  <td><b>{s.name}</b><br /><Plate code={s.code} /></td>
                  <td><span className={`tag ${x[0] === "live" ? "" : x[0] === "stale" ? "due" : "bad"}`}>{x[1]}</span>{x[0] === "off" && s.loc ? <><br /><small className="mute">last known {ago(s.loc.updated_at)}</small></> : null}</td>
                  <td>{s.loc ? `${km(hub, s.loc).toFixed(1)} km` : "–"}</td>
                  <td><button className="a" onClick={() => setInfo(s)}>View</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note">Riders share their location from the Brotherhood Mobility app while it&apos;s open (agreement point 14). Continuous background tracking needs the Android app or a GPS tracker on the scooter.</p>

      <Modal open={!!info} onClose={() => setInfo(null)}>
        {info && (() => {
          const x = state(info);
          return (
            <>
              <h2>{info.name} · {info.code}</h2>
              <p><span className={`tag ${x[0] === "live" ? "" : x[0] === "stale" ? "due" : "bad"}`}>{x[1]}</span></p>
              {info.loc ? (
                <>
                  <div className="pt"><span className="mute">Last update</span><b>{ago(info.loc.updated_at)}</b></div>
                  <div className="pt"><span className="mute">Distance from hub</span><b>{km(hub, info.loc).toFixed(1)} km</b></div>
                  {info.loc.accuracy != null && <div className="pt"><span className="mute">Accuracy</span><b>about {Math.round(info.loc.accuracy)} m</b></div>}
                </>
              ) : <p className="mute">This rider hasn&apos;t shared their location yet.</p>}
              <div className="btns" style={{ marginTop: 12 }}>
                {info.mobile && <a className="a" style={{ textDecoration: "none", padding: "8px 13px", border: "1.5px solid var(--line)", borderRadius: 10 }} href={`tel:${info.mobile}`}>Call rider</a>}
                {info.loc && <a className="a p" style={{ textDecoration: "none", padding: "8px 13px", borderRadius: 10, background: "var(--plate)", color: "#fff" }} href={`https://www.google.com/maps?q=${info.loc.lat},${info.loc.lng}`} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>}
                <button className="a" onClick={() => setInfo(null)}>Close</button>
              </div>
            </>
          );
        })()}
      </Modal>
      <Modal open={hubOpen} onClose={() => setHubOpen(false)}>
        <h2>Set hub location</h2>
        <p className="mute">Your office or parking yard. In Google Maps, long-press the spot and copy the two numbers shown.</p>
        <label>Latitude, longitude</label>
        <input value={hubText} onChange={(e) => setHubText(e.target.value)} />
        {err && <p className="lerr">{err}</p>}
        <div className="btns">
          <button className="a" onClick={() => setHubOpen(false)}>Cancel</button>
          <button className="a p" onClick={async () => {
            const [a, b] = hubText.split(",").map((v) => Number(v.trim()));
            const res = await saveHub(a, b);
            if (!res.ok) { setErr(res.error); return; }
            setErr(""); setHubOpen(false); router.refresh();
          }}>Save hub</button>
        </div>
      </Modal>
    </>
  );
}
