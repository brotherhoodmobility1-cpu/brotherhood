"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import Plate from "./plate";
import Empty from "./empty";
import CredModal, { type Cred } from "./cred-modal";
import RiderDetails from "./rider-details";
import WhatsAppButton from "./whatsapp-button";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { formatDate, perDay, rupees } from "@/lib/format";
import { riderTag } from "@/lib/status";
import { allotScooter, authoriseRider, removeWaiting, returnScooter, updateRider, type ActionResult } from "@/app/riders/actions";

export type ActiveRider = {
  id: string; full_name: string; mobile: string | null; start_date: string | null; weekly_rent: number;
  security_deposit: number; wallet_balance: number; action_needed: boolean;
  scooters: { code: string; chassis_no: string | null } | null;
};
export type WaitingRider = { id: string; full_name: string; mobile: string | null; weekly_rent: number; security_deposit: number; created_at: string };
export type PastRider = {
  id: string; full_name: string; mobile: string | null; start_date: string | null; end_date: string | null; security_deposit: number;
  wallet_balance: number; return_charges: number | null; return_note: string | null; settlement: number | null;
  return_photos: string[] | null; scooters: { code: string } | null;
};
export type FreeScooter = { id: number; code: string; chassis_no: string | null };

type Ask = { title: string; body: ReactNode; yes: string; danger?: boolean; run: () => Promise<ActionResult> };
const SIDES: [string, string][] = [["front", "Front"], ["back", "Back"], ["left", "Left side"], ["right", "Right side"]];
const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export default function RidersManager({ owner, active, waiting, past, free, prefill, qrUrl, upiId }: {
  owner: boolean; active: ActiveRider[]; waiting: WaitingRider[]; past: PastRider[]; free: FreeScooter[];
  prefill: { enquiry: number; name: string; mobile: string } | null; qrUrl: string | null; upiId: string;
}) {
  const [detail, setDetail] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const router = useRouter();
  const [err, setErr] = useState("");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState(false);
  const [cred, setCred] = useState<Cred | null>(null);
  const [done, setDone] = useState<{ title: string; body: string } | null>(null);

  // authorise form
  const [auth, setAuth] = useState<{ open: boolean; name: string; mobile: string; rent: string; dep: string; enquiry?: number }>(
    { open: false, name: "", mobile: "", rent: "2000", dep: "1500" });
  useEffect(() => {
    if (prefill && owner) setAuth({ open: true, name: prefill.name, mobile: prefill.mobile, rent: "2000", dep: "1500", enquiry: prefill.enquiry });
  }, [prefill, owner]);

  // allot form
  const [allot, setAllot] = useState<{ rider: WaitingRider; scooter: string; date: string; dep: boolean } | null>(null);
  // return form
  const [ret, setRet] = useState<{ rider: ActiveRider; photos: Record<string, string>; previews: Record<string, string>; charges: string; note: string; mech: boolean; uploading: string } | null>(null);
  // edit form
  const [edit, setEdit] = useState<{ rider: ActiveRider; name: string; rent: string; dep: string; start: string } | null>(null);
  // past details
  const [pastView, setPastView] = useState<{ rider: PastRider; urls: string[] } | null>(null);

  async function runAsk() {
    if (!ask) return;
    setBusy(true);
    const res = await ask.run();
    setBusy(false);
    setAsk(null);
    if (!res.ok) { setErr(res.error); return; }
    setErr("");
    if (res.password && res.name && res.mobile) setCred({ name: res.name, mobile: res.mobile, password: res.password, note: res.message });
    else if (res.message) setDone({ title: "Done", body: res.message });
    router.refresh();
  }

  async function uploadSide(side: string, file?: File) {
    if (!file || !ret) return;
    setRet({ ...ret, uploading: side });
    try {
      const blob = await compressImage(file);
      const path = `${ret.rider.id}/${side}-${Date.now()}.jpg`;
      const { error } = await createClient().storage.from("return-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setRet((r) => r && { ...r, uploading: "", photos: { ...r.photos, [side]: path }, previews: { ...r.previews, [side]: URL.createObjectURL(blob) } });
    } catch {
      setRet((r) => r && { ...r, uploading: "" });
      setErr("Couldn't upload that photo. Please try again.");
    }
  }

  async function openPast(r: PastRider) {
    let urls: string[] = [];
    if (r.return_photos?.length) {
      const { data } = await createClient().storage.from("return-photos").createSignedUrls(r.return_photos, 3600);
      urls = (data ?? []).map((d) => d.signedUrl ?? "").filter(Boolean);
    }
    setPastView({ rider: r, urls });
  }

  return (
    <>
      {err && <p className="lerr" role="alert">{err}</p>}
      {owner && <button className="a p" onClick={() => setAuth({ open: true, name: "", mobile: "", rent: "2000", dep: "1500" })}>+ Authorise new rider</button>}

      <h2>Approved, waiting for a scooter ({waiting.length})</h2>
      {waiting.length === 0 ? (
        <p className="mute">{owner ? "Nobody waiting. Tap Authorise new rider, or approve someone from Enquiries." : "Nobody waiting. The owner authorises new riders."}</p>
      ) : waiting.map((w) => (
        <div className="row" key={w.id}>
          <div className="m"><b>{w.full_name}</b><small>{w.mobile} · {rupees(w.weekly_rent)}/week · deposit {rupees(w.security_deposit)}</small></div>
          <button className="a p" onClick={() => free.length ? setAllot({ rider: w, scooter: String(free[0].id), date: todayISO(), dep: false }) : setErr("No scooter is available right now.")}>Allot scooter</button>
          {owner && <button className="a" onClick={() => setAsk({
            title: `Remove ${w.full_name}?`, body: "They will no longer be able to log in.", yes: "Yes, remove", danger: true,
            run: () => removeWaiting(w.id),
          })}>Remove</button>}
        </div>
      ))}
      <p className="mute">Scooters available to allot: {free.length}</p>

      <h2>Active riders ({active.length})</h2>
      <input placeholder="Search rider, scooter or mobile" value={q} onChange={(e) => setQ(e.target.value)} />
      {active.filter((r) => !q || `${r.full_name} ${r.scooters?.code ?? ""} ${r.mobile ?? ""}`.toLowerCase().includes(q.toLowerCase())).map((r) => {
        const t = riderTag(r);
        return (
          <div className="row" key={r.id}>
            <div className="m">
              <b>{r.full_name} · {r.scooters ? <Plate code={r.scooters.code} /> : "–"}</b>
              <small>Started {formatDate(r.start_date)} · {rupees(perDay(r.weekly_rent))}/day · wallet {rupees(r.wallet_balance)} · deposit {rupees(r.security_deposit)}{r.mobile ? ` · ${r.mobile}` : " · mobile missing"}</small>
            </div>
            <span className={`tag ${t[0]}`}>{t[1]}</span>
            {r.mobile && <a className="tag" href={`tel:${r.mobile}`}>Call</a>}
            <WhatsAppButton r={{ name: r.full_name, mobile: r.mobile, code: r.scooters?.code ?? "", weeklyRent: r.weekly_rent, wallet: r.wallet_balance, startDate: r.start_date }} qrUrl={qrUrl} upiId={upiId} compact />
            <button className="a" onClick={() => setDetail(r.id)}>Details</button>
            <button className="a" onClick={() => setRet({ rider: r, photos: {}, previews: {}, charges: "", note: "", mech: true, uploading: "" })}>Return scooter</button>
            {owner && <button className="a" onClick={() => setEdit({ rider: r, name: r.full_name, rent: String(r.weekly_rent), dep: String(r.security_deposit), start: r.start_date ?? "" })}>Edit</button>}
          </div>
        );
      })}

      <h2>Past riders ({past.length})</h2>
      {past.length === 0 ? <Empty text="Riders appear here after their scooter is returned." /> : past.map((p) => (
        <div className="row" key={p.id}>
          <div className="m">
            <b>{p.full_name} · {p.scooters ? <Plate code={p.scooters.code} /> : "–"}</b>
            <small>{formatDate(p.start_date)} to {formatDate(p.end_date)} · {Number(p.settlement) >= 0 ? `refund ${rupees(p.settlement)}` : `owed ${rupees(-Number(p.settlement))}`}</small>
          </div>
          <span className="tag">Closed</span>
          <button className="a" onClick={() => openPast(p)}>Details</button>
        </div>
      ))}

      {/* Authorise */}
      <Modal open={auth.open} onClose={() => setAuth({ ...auth, open: false })}>
        <h2>Authorise new rider</h2>
        <p className="mute">The rider can log in with this mobile number. Staff can then allot an available scooter.</p>
        <label>Full name</label><input value={auth.name} onChange={(e) => setAuth({ ...auth, name: e.target.value })} />
        <label>Mobile number</label><input type="tel" inputMode="numeric" value={auth.mobile} onChange={(e) => setAuth({ ...auth, mobile: e.target.value })} />
        <label>Weekly rent (₹)</label><input type="number" value={auth.rent} onChange={(e) => setAuth({ ...auth, rent: e.target.value })} />
        <label>Security deposit (₹)</label><input type="number" value={auth.dep} onChange={(e) => setAuth({ ...auth, dep: e.target.value })} />
        <div className="btns">
          <button className="a" onClick={() => setAuth({ ...auth, open: false })}>Cancel</button>
          <button className="a p" onClick={() => {
            const m = auth.mobile.replace(/\D/g, "").slice(-10);
            if (!auth.name.trim() || m.length !== 10 || !(Number(auth.rent) > 0)) { setErr("Enter the name, a 10-digit mobile number and weekly rent."); return; }
            setErr("");
            setAuth({ ...auth, open: false });
            setAsk({
              title: `Authorise ${auth.name.trim()}?`,
              body: <ul className="ck"><li>Mobile {m} can log in as a rider</li><li>Weekly rent {rupees(auth.rent)} ({rupees(perDay(auth.rent))} per day)</li><li>Security deposit {rupees(auth.dep)}</li><li>Staff will allot an available scooter</li></ul>,
              yes: "Yes, authorise",
              run: () => authoriseRider(auth.name, m, Number(auth.rent), Number(auth.dep), auth.enquiry),
            });
          }}>Continue</button>
        </div>
      </Modal>

      {/* Allot */}
      <Modal open={!!allot} onClose={() => setAllot(null)}>
        {allot && (
          <>
            <h2>Allot scooter to {allot.rider.full_name}</h2>
            <label>Available scooter</label>
            <select value={allot.scooter} onChange={(e) => setAllot({ ...allot, scooter: e.target.value })}>
              {free.map((s) => <option key={s.id} value={s.id}>{s.code} · chassis {s.chassis_no ?? "–"}</option>)}
            </select>
            <label>Start date</label>
            <input type="date" value={allot.date} onChange={(e) => setAllot({ ...allot, date: e.target.value })} />
            <div className="pt"><span>Weekly rent</span><b>{rupees(allot.rider.weekly_rent)}</b></div>
            <div className="pt"><span>Security deposit</span><b>{rupees(allot.rider.security_deposit)}</b></div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink)", fontSize: 14, margin: "10px 0" }}>
              <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={allot.dep} onChange={(e) => setAllot({ ...allot, dep: e.target.checked })} />
              Security deposit of {rupees(allot.rider.security_deposit)} received
            </label>
            <div className="btns">
              <button className="a" onClick={() => setAllot(null)}>Cancel</button>
              <button className="a p" onClick={() => {
                if (!allot.dep) { setErr("Tick that the security deposit has been received before handing over the scooter."); return; }
                const s = free.find((x) => String(x.id) === allot.scooter);
                const a = allot;
                setAllot(null);
                setAsk({
                  title: `Allot ${s?.code} to ${a.rider.full_name}?`,
                  body: <ul className="ck"><li>Start date {formatDate(a.date)}</li><li>{rupees(a.rider.weekly_rent)} per week, charged {rupees(perDay(a.rider.weekly_rent))} daily from the wallet</li><li>Deposit {rupees(a.rider.security_deposit)} received</li><li>{a.rider.full_name} can now log in to their wallet and documents</li></ul>,
                  yes: "Yes, allot scooter",
                  run: () => allotScooter(a.rider.id, Number(a.scooter), a.date, true),
                });
              }}>Continue</button>
            </div>
          </>
        )}
      </Modal>

      {/* Return */}
      <Modal open={!!ret} onClose={() => !ret?.uploading && setRet(null)}>
        {ret && (() => {
          const chg = Math.max(0, Math.round(Number(ret.charges) || 0));
          const set = Number(ret.rider.security_deposit) + Number(ret.rider.wallet_balance) - chg;
          return (
            <>
              <h2>Return {ret.rider.scooters?.code} from {ret.rider.full_name}</h2>
              <p className="mute">Take photos of the scooter as it comes back.</p>
              {SIDES.map(([k, label]) => (
                <div className="pt" key={k}>
                  <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {ret.previews[k] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ret.previews[k]} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8 }} />
                    ) : <span style={{ width: 52, height: 52, border: "1px dashed var(--mute)", borderRadius: 8, display: "inline-block" }} />}
                    {label}{ret.uploading === k ? " · uploading…" : ""}
                  </span>
                  <label style={{ border: "1px solid var(--line)", padding: "6px 11px", borderRadius: 8, cursor: "pointer", color: "var(--ink)", fontSize: 13, fontWeight: 600, margin: 0 }}>
                    {ret.photos[k] ? "Retake" : "Photo"}
                    <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={!!ret.uploading}
                      onChange={(e) => uploadSide(k, e.target.files?.[0])} />
                  </label>
                </div>
              ))}
              <label style={{ marginTop: 10 }}>Damage, fines or other charges (₹)</label>
              <input type="number" placeholder="0" value={ret.charges} onChange={(e) => setRet({ ...ret, charges: e.target.value })} />
              <label>Notes on condition</label>
              <textarea rows={2} value={ret.note} onChange={(e) => setRet({ ...ret, note: e.target.value })} />
              <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink)", fontSize: 14, margin: "0 0 10px" }}>
                <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={ret.mech} onChange={(e) => setRet({ ...ret, mech: e.target.checked })} />
                Send to mechanic for check and wash before the next rider
              </label>
              <div className="btns">
                <button className="a" onClick={() => setRet(null)} disabled={!!ret.uploading}>Cancel</button>
                <button className="a p" disabled={!!ret.uploading} onClick={() => {
                  const miss = SIDES.filter(([k]) => !ret.photos[k]).length;
                  if (miss) { setErr(`Add all 4 photos of the returned scooter (${miss} missing).`); return; }
                  const r = ret;
                  setRet(null);
                  setAsk({
                    title: `Are you sure ${r.rider.scooters?.code} is being returned?`,
                    body: (
                      <>
                        <p className="mute">{r.rider.full_name}&apos;s rental will be closed and their login will stop working. This can&apos;t be undone.</p>
                        <div className="pt"><span>Security deposit</span><b>{rupees(r.rider.security_deposit)}</b></div>
                        <div className="pt"><span>Wallet balance</span><b>{rupees(r.rider.wallet_balance)}</b></div>
                        <div className="pt"><span>Damage and other charges</span><b>{chg ? `-${rupees(chg)}` : rupees(0)}</b></div>
                        <div className="pt"><span><b>{set >= 0 ? "Refund to rider" : "Rider still owes"}</b></span><b style={{ color: set >= 0 ? "var(--ev)" : "var(--bad)" }}>{rupees(Math.abs(set))}</b></div>
                        <p className="mute">Scooter goes to: {r.mech ? "mechanic for check and wash" : "available for the next rider"}.</p>
                      </>
                    ),
                    yes: "Yes, scooter returned",
                    danger: true,
                    run: () => returnScooter(r.rider.id, chg, r.note, SIDES.map(([k]) => r.photos[k]), r.mech),
                  });
                }}>Continue</button>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* Edit */}
      <Modal open={!!edit} onClose={() => setEdit(null)}>
        {edit && (
          <>
            <h2>Edit {edit.rider.scooters?.code}</h2>
            <label>Rider name</label><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <label>Start date</label><input type="date" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} />
            <label>Weekly rent (₹), charged daily as weekly ÷ 7</label><input type="number" value={edit.rent} onChange={(e) => setEdit({ ...edit, rent: e.target.value })} />
            <label>Security deposit (₹)</label><input type="number" value={edit.dep} onChange={(e) => setEdit({ ...edit, dep: e.target.value })} />
            <div className="btns">
              <button className="a" onClick={() => setEdit(null)}>Cancel</button>
              <button className="a p" onClick={() => {
                const e = edit;
                const changes: [string, string, string][] = [];
                if (e.name.trim() !== e.rider.full_name) changes.push(["Rider", e.rider.full_name, e.name.trim()]);
                if (e.start !== (e.rider.start_date ?? "")) changes.push(["Start date", formatDate(e.rider.start_date), formatDate(e.start || null)]);
                if (Number(e.rent) !== Number(e.rider.weekly_rent)) changes.push(["Weekly rent", rupees(e.rider.weekly_rent), rupees(e.rent)]);
                if (Number(e.dep) !== Number(e.rider.security_deposit)) changes.push(["Deposit", rupees(e.rider.security_deposit), rupees(e.dep)]);
                setEdit(null);
                if (!changes.length) return;
                setAsk({
                  title: "Check before saving",
                  body: (
                    <>
                      <p className="mute">This changes live records. A new rent or start date moves this rider&apos;s due dates and reminders.</p>
                      <ul className="ck">{changes.map((c) => <li key={c[0]}>{c[0]}: <s>{c[1]}</s> → <b>{c[2]}</b></li>)}</ul>
                    </>
                  ),
                  yes: "Yes, apply changes",
                  danger: true,
                  run: () => updateRider(e.rider.id, { full_name: e.name, weekly_rent: Number(e.rent), security_deposit: Number(e.dep), start_date: e.start || null }),
                });
              }}>Save changes</button>
            </div>
          </>
        )}
      </Modal>

      {/* Past details */}
      <Modal open={!!pastView} onClose={() => setPastView(null)}>
        {pastView && (
          <>
            <h2>{pastView.rider.full_name} · {pastView.rider.scooters?.code}</h2>
            <p><span className="tag">Closed</span></p>
            <div className="pt"><span className="mute">Mobile</span><b>{pastView.rider.mobile ?? "Not set"}</b></div>
            <div className="pt"><span className="mute">Rental</span><b>{formatDate(pastView.rider.start_date)} to {formatDate(pastView.rider.end_date)}</b></div>
            <div className="pt"><span className="mute">Security deposit</span><b>{rupees(pastView.rider.security_deposit)}</b></div>
            <div className="pt"><span className="mute">Wallet at return</span><b>{rupees(pastView.rider.wallet_balance)}</b></div>
            <div className="pt"><span className="mute">Charges</span><b>{rupees(pastView.rider.return_charges)}</b></div>
            <div className="pt"><span className="mute">{Number(pastView.rider.settlement) >= 0 ? "Refund to rider" : "Rider owed"}</span><b>{rupees(Math.abs(Number(pastView.rider.settlement)))}</b></div>
            {pastView.rider.return_note && <p>{pastView.rider.return_note}</p>}
            <h2>Photos at return</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="ph">{pastView.urls.map((u) => <img key={u} src={u} alt="" />)}</div>
            <div className="btns"><button className="a p" onClick={() => setPastView(null)}>Close</button></div>
          </>
        )}
      </Modal>

      {/* Confirm */}
      <Modal open={!!ask} onClose={() => !busy && setAsk(null)}>
        {ask && (
          <>
            <h2>{ask.title}</h2>
            <div>{ask.body}</div>
            <div className="btns">
              <button className="a" onClick={() => setAsk(null)} disabled={busy}>Go back</button>
              <button className={`a ${ask.danger ? "d" : "p"}`} onClick={runAsk} disabled={busy}>{busy ? "Working…" : ask.yes}</button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!done} onClose={() => setDone(null)}>
        {done && (
          <div className="okm">
            <div className="okc"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
            <h2>{done.title}</h2>
            <p><b>{done.body}</b></p>
            <div className="btns" style={{ justifyContent: "center" }}><button className="a p" onClick={() => setDone(null)}>Okay</button></div>
          </div>
        )}
      </Modal>

      <CredModal cred={cred} onClose={() => setCred(null)} />
      <RiderDetails riderId={detail} onClose={() => { setDetail(null); router.refresh(); }} qrUrl={qrUrl} upiId={upiId} />
    </>
  );
}
