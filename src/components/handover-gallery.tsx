"use client";

import { useEffect, useState } from "react";
import Modal from "./modal";
import { createClient } from "@/lib/supabase/client";
import PhotoSourceTag from "./photo-source-tag";
import { whenIST } from "@/lib/ist";
import { HANDOVER_SLOTS, KIND_LABEL, type HandoverRow } from "@/lib/handover";

type Row = HandoverRow & { riders: { full_name: string } | null; scooters: { code: string } | null };

/** Every handover (with photos) for a rider or a scooter, newest first. */
export default function HandoverGallery({ riderId, scooterId }: { riderId?: string; scooterId?: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [big, setBig] = useState("");

  useEffect(() => {
    const s = createClient();
    (async () => {
      let q = s.from("handovers").select("*, riders(full_name), scooters(code)").order("created_at", { ascending: false }).limit(30);
      q = riderId ? q.eq("rider_id", riderId) : q.eq("scooter_id", scooterId!);
      const { data } = await q;
      const list = (data ?? []) as Row[];
      setRows(list);
      const paths = list.flatMap((h) => Object.values(h.photos ?? {}));
      if (paths.length) {
        const { data: signed } = await s.storage.from("handover-photos").createSignedUrls(paths, 3600);
        const m: Record<string, string> = {};
        (signed ?? []).forEach((x) => { if (x.path && x.signedUrl) m[x.path] = x.signedUrl; });
        setUrls(m);
      }
    })();
  }, [riderId, scooterId]);

  if (!rows) return <p className="mute">Loading…</p>;
  if (!rows.length) return <p className="mute">No handovers recorded yet.</p>;
  return (
    <>
      {rows.map((h) => (
        <div className="row" style={{ display: "block" }} key={h.id}>
          <b>{KIND_LABEL[h.kind] ?? h.kind} · {whenIST(h.created_at)}</b>
          <div className="mute">
            {h.scooters?.code}{h.riders ? ` · rider ${h.riders.full_name}` : ""} · handed to {h.to_name}
            {h.odometer_km != null ? ` · ${h.odometer_km} km` : ""}{h.battery_pct != null ? ` · battery ${h.battery_pct}%` : ""}
            {h.kind !== "return" && h.rider_id ? (h.rider_confirmed_at ? ` · rider confirmed ${whenIST(h.rider_confirmed_at)}` : " · rider hasn't confirmed yet") : ""}
          </div>
          <PhotoSourceTag path={Object.values(h.photos ?? {})[0]} />
          {h.checklist && (
            <div className="mute" style={{ fontSize: 13 }}>
              {Object.entries(h.checklist).map(([k, v]) => `${v ? "✓" : "✗"} ${k}`).join("  ")}
            </div>
          )}
          <div className="ph">
            {HANDOVER_SLOTS.map(([k, label]) => h.photos?.[k] && urls[h.photos[k]] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={k} src={urls[h.photos[k]]} alt={label} title={label} style={{ cursor: "zoom-in" }} onClick={() => setBig(urls[h.photos[k]])} />
            ) : null)}
          </div>
        </div>
      ))}
      <Modal open={!!big} onClose={() => setBig("")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={big} alt="" style={{ width: "100%", borderRadius: 8 }} />
        <div className="btns" style={{ marginTop: 10 }}><button className="a" onClick={() => setBig("")}>Close</button></div>
      </Modal>
    </>
  );
}
