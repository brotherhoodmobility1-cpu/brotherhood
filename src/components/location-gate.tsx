"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "./icons";

/** Riders must share location to use the app (agreement point 14). Sends the position now and every 2 minutes while open. */
export default function LocationGate({ riderIds, code, children }: { riderIds: string[]; code: string; children: ReactNode }) {
  const [state, setState] = useState<"checking" | "ask" | "ok" | "blocked">("checking");
  const last = useRef(0);

  async function send(p: GeolocationPosition) {
    if (Date.now() - last.current < 110000) return;
    last.current = Date.now();
    const supabase = createClient();
    await supabase.from("rider_locations").upsert(
      riderIds.map((id) => ({ rider_id: id, lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, updated_at: new Date().toISOString() })),
      { onConflict: "rider_id" }
    );
  }

  function start() {
    if (!navigator.geolocation) { setState("blocked"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setState("ok");
        last.current = 0;
        send(p);
        navigator.geolocation.watchPosition(send, () => {}, { enableHighAccuracy: true, maximumAge: 60000 });
      },
      () => setState("blocked"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  useEffect(() => {
    if (!navigator.permissions) { setState("ask"); return; }
    navigator.permissions.query({ name: "geolocation" as PermissionName }).then(
      (r) => (r.state === "granted" ? start() : setState(r.state === "denied" ? "blocked" : "ask")),
      () => setState("ask")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "ok") return <>{children}</>;
  if (state === "checking") return <div className="phone"><p className="mute">Loading…</p></div>;
  return (
    <div className="phone" style={{ textAlign: "center" }}>
      <div className="pin"><Icon name="Live map" /></div>
      <h2>{state === "blocked" ? "Location is blocked" : "Turn on location sharing"}</h2>
      {state === "blocked" ? (
        <p>Please allow location for this site in your phone&apos;s browser settings (Chrome → Site settings → Location), then tap Try again.</p>
      ) : (
        <p>Brotherhood Mobility needs your location while you rent {code}. It keeps the scooter safe and helps our mechanic reach you quickly in a breakdown.</p>
      )}
      <p className="hin" lang="hi">स्कूटर की सुरक्षा और ब्रेकडाउन में जल्दी मदद के लिए किराये के दौरान आपकी लोकेशन शेयर करना ज़रूरी है।</p>
      <button className="a p" style={{ width: "100%", padding: 12 }} onClick={start}>{state === "blocked" ? "Try again" : "Allow location"}</button>
      <p className="note">You agreed to this in point 14 of your rental agreement. Your phone will ask for permission next.</p>
    </div>
  );
}
