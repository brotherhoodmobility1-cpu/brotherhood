"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import Plate from "./plate";
import Empty from "./empty";
import { DOC_LABEL } from "@/lib/docs";
import { rejectDocument, verifyDocuments } from "@/app/documents/actions";

export type PendingRider = { riderId: string; name: string; code: string; docs: { id: number; kind: string; url: string }[] };
type Ask = { title: string; body: string; yes: string; danger?: boolean; run: () => Promise<{ ok: boolean; error: string }> };

export default function DocReview({ riders, fully }: { riders: PendingRider[]; fully: number }) {
  const router = useRouter();
  const [ask, setAsk] = useState<Ask | null>(null);
  const [big, setBig] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    if (!ask) return;
    setBusy(true);
    const res = await ask.run();
    setBusy(false);
    setAsk(null);
    setErr(res.ok ? "" : res.error);
    router.refresh();
  }

  return (
    <>
      <h2>Waiting for verification ({riders.length} riders)</h2>
      {err && <p className="lerr" role="alert">{err}</p>}
      {riders.length === 0 && <Empty text="Nothing waiting. Documents riders upload appear here." />}
      {riders.map((r) => (
        <div className="row" style={{ display: "block" }} key={r.riderId}>
          <b>{r.name} · <Plate code={r.code} /></b>{" "}
          <button className="a" style={{ float: "right" }} onClick={() => setAsk({
            title: `Verify all ${r.docs.length} documents?`,
            body: `${r.name}. After verifying, the rider can't upload or change these documents again.`,
            yes: "Yes, verify all",
            run: () => verifyDocuments(r.docs.map((d) => d.id)),
          })}>Verify all</button>
          {r.docs.map((d) => (
            <div className="pt" key={d.id}>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.url} alt={DOC_LABEL[d.kind]} onClick={() => setBig(d.url)}
                  style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, cursor: "zoom-in" }} />
                {DOC_LABEL[d.kind] ?? d.kind}
              </span>
              <span style={{ display: "flex", gap: 6 }}>
                <button className="a p" onClick={() => setAsk({
                  title: `Verify ${DOC_LABEL[d.kind]}?`,
                  body: `${r.name}. After verifying, the rider can't upload or change this document again.`,
                  yes: "Yes, verify",
                  run: () => verifyDocuments([d.id]),
                })}>Verify</button>
                <button className="a" onClick={() => setAsk({
                  title: `Reject ${DOC_LABEL[d.kind]}?`,
                  body: `${r.name}. The rider is asked to upload it again.`,
                  yes: "Yes, reject",
                  danger: true,
                  run: () => rejectDocument(d.id),
                })}>Reject</button>
              </span>
            </div>
          ))}
        </div>
      ))}
      <p className="note">{fully} riders fully verified. Tap a photo to see it bigger.</p>

      <Modal open={!!ask} onClose={() => !busy && setAsk(null)}>
        {ask && (
          <>
            <h2>{ask.title}</h2>
            <p className="mute">{ask.body}</p>
            <div className="btns">
              <button className="a" onClick={() => setAsk(null)} disabled={busy}>Go back</button>
              <button className={`a ${ask.danger ? "d" : "p"}`} onClick={go} disabled={busy}>{busy ? "Working…" : ask.yes}</button>
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
