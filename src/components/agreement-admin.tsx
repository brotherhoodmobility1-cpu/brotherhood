"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import Plate from "./plate";
import AgreementText from "./agreement-text";
import { saveAgreementVersion } from "@/app/agreement/actions";

export type SignRow = {
  id: string; name: string; code: string; state: "none" | "old" | "ok";
  signed: { version: number; body: string; signed_at: string; mobile: string | null } | null;
};

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default function AgreementAdmin({ owner, version, body, rows }: { owner: boolean; version: number; body: string; rows: SignRow[] }) {
  const router = useRouter();
  const [text, setText] = useState(body);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [view, setView] = useState<SignRow | null>(null);

  const Section = ({ title, list }: { title: string; list: SignRow[] }) => (
    <>
      <h2>{title} ({list.length})</h2>
      {list.length === 0 ? <p className="mute">None.</p> : list.map((r) => (
        <div className="row" key={r.id}>
          <div className="m"><b>{r.name} · <Plate code={r.code} /></b></div>
          <span className={`tag ${r.state === "ok" ? "" : "due"}`}>
            {r.state === "none" ? "Not signed" : r.state === "old" ? "Old version, sign again" : `Signed ${when(r.signed!.signed_at)}`}
          </span>
          {r.signed && <button className="a" onClick={() => setView(r)}>View</button>}
        </div>
      ))}
    </>
  );

  return (
    <>
      <h2>Agreement template · version {version}</h2>
      {err && <p className="lerr" role="alert">{err}</p>}
      {owner ? (
        <>
          <p className="mute">Words in curly brackets are filled in for each rider: {"{name} {mobile} {start} {scooter} {chassis} {rent} {daily} {deposit} {min}"}</p>
          <textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} />
          <button className="a p" onClick={() => (text.trim() === body.trim() ? setErr("No changes to save.") : (setErr(""), setAsk(true)))}>Save new version</button>
        </>
      ) : (
        <div className="row" style={{ display: "block" }}><AgreementText text={body} /></div>
      )}
      <Section title="Not signed" list={rows.filter((r) => r.state === "none")} />
      <Section title="Signed an older version" list={rows.filter((r) => r.state === "old")} />
      <Section title="Signed" list={rows.filter((r) => r.state === "ok")} />

      <Modal open={ask} onClose={() => !busy && setAsk(false)}>
        <h2>Save as version {version + 1}?</h2>
        <p className="mute">Every rider will be asked to read and sign the new version. Agreements already signed stay saved as they are.</p>
        <div className="btns">
          <button className="a" onClick={() => setAsk(false)} disabled={busy}>Go back</button>
          <button className="a d" disabled={busy} onClick={async () => {
            setBusy(true);
            const res = await saveAgreementVersion(text);
            setBusy(false); setAsk(false);
            if (!res.ok) setErr(res.error); else router.refresh();
          }}>{busy ? "Saving…" : "Yes, save new version"}</button>
        </div>
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)}>
        {view?.signed && (
          <>
            <AgreementText text={view.signed.body} />
            <div className="row" style={{ display: "block", marginTop: 10 }}>
              <b>Signed electronically</b>
              <small className="mute" style={{ display: "block" }}>
                By {view.name} · mobile {view.signed.mobile ?? "(not set)"} · {when(view.signed.signed_at)} · confirmed with password · version {view.signed.version}
              </small>
            </div>
            <div className="btns"><button className="a p" onClick={() => setView(null)}>Close</button></div>
          </>
        )}
      </Modal>
    </>
  );
}
