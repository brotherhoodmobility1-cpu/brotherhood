"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import Plate from "./plate";
import Empty from "./empty";
import { DOC_LABEL } from "@/lib/docs";
import { rejectDocument, verifyDocuments } from "@/app/documents/actions";
import { getBundle } from "@/app/documents/bundle";
import { downloadBundle } from "@/lib/pdf-bundle";

export type PendingRider = { riderId: string; name: string; code: string; docs: { id: number; kind: string; url: string }[] };
type Ask = { title: string; body: string; yes: string; danger?: boolean; run: () => Promise<{ ok: boolean; error: string }> };

export default function DocReview({ riders, fully, ready }: { riders: PendingRider[]; fully: number; ready: { riderId: string; name: string; code: string }[] }) {
  const [making, setMaking] = useState("");
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
      <h2>Fully verified: document bundle ({ready.length})</h2>
      {ready.length === 0 ? (
        <p className="mute">A rider appears here once all 12 documents are verified and the current agreement is signed.</p>
      ) : ready.map((r) => (
        <div className="row" key={r.riderId}>
          <div className="m"><b>{r.name} · <Plate code={r.code} /></b><small>Signed agreement and all documents in one PDF</small></div>
          <button className="a p" disabled={!!making} onClick={async () => {
            setMaking(r.riderId); setErr("");
            try {
              const res = await getBundle(r.riderId);
              if (!res.ok || !res.data) throw new Error(res.error);
              await downloadBundle(res.data);
            } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't create the PDF."); }
            setMaking("");
          }}>{making === r.riderId ? "Preparing PDF…" : "Download PDF"}</button>
        </div>
      ))}

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
