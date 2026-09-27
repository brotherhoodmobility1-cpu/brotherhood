"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import Plate from "./plate";
import HandoverGallery from "./handover-gallery";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { detectSource, taggedPath } from "@/lib/photo-source";
import PhotoSourceTag from "./photo-source-tag";
import { displayDue, formatDate, rupees } from "@/lib/format";
import { whenIST } from "@/lib/ist";
import { INSURANCE_SOON, PAPER_KINDS, SWAP_SOON, expiryTag, type SwapPlan } from "@/lib/passport";
import { retireScooter, updateScooter } from "@/app/passport/actions";

type Scooter = {
  id: number; code: string; chassis_no: string | null; motor_no: string | null; model: string | null; reg_no: string | null;
  purchase_date: string | null; status: string; insurance_company: string | null; insurance_policy: string | null;
  insurance_from: string | null; insurance_to: string | null;
};
type Rider = { id: string; full_name: string; mobile: string | null; wallet_balance: number; weekly_rent: number; start_date: string | null };
type Paper = { id: number; kind: string; path: string; note: string | null; created_at: string };
type Job = { ticket: string; status: string; issue: string | null; reason: string; closed_at: string | null; created_at: string };

const STATUS: Record<string, string> = { rented: "Rented", available: "Available", workshop: "With mechanic", retired: "Retired" };

export default function ScooterFile({ scooterId, onClose, owner }: { scooterId: number | null; onClose: () => void; owner: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"Overview" | "Swap plan" | "Papers" | "Handovers">("Overview");
  const [s, setS] = useState<Scooter | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [plans, setPlans] = useState<SwapPlan[]>([]);
  const [papers, setPapers] = useState<(Paper & { url: string })[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loc, setLoc] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState("");
  const [edit, setEdit] = useState<{ chassis_no: string; motor_no: string; model: string; reg_no: string; purchase_date: string } | null>(null);
  const [plan, setPlan] = useState<{ provider: string; plan_name: string; amount: string; swaps_total: string; kwh: string; starts_on: string; ends_on: string; slip: File | null } | null>(null);
  const [used, setUsed] = useState("");
  const [ins, setIns] = useState<{ company: string; policy: string; from: string; to: string } | null>(null);
  const [paperKind, setPaperKind] = useState("rc");
  const [retire, setRetire] = useState(false);
  const [slips, setSlips] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!scooterId) return;
    const sb = createClient();
    const [sc, rd, pl, pp, jb] = await Promise.all([
      sb.from("scooters").select("id, code, chassis_no, motor_no, model, reg_no, purchase_date, status, insurance_company, insurance_policy, insurance_from, insurance_to").eq("id", scooterId).single(),
      sb.from("riders").select("id, full_name, mobile, wallet_balance, weekly_rent, start_date").eq("scooter_id", scooterId).eq("status", "active").maybeSingle(),
      sb.from("swap_plans").select("*").eq("scooter_id", scooterId).order("starts_on", { ascending: false }),
      sb.from("scooter_papers").select("id, kind, path, note, created_at").eq("scooter_id", scooterId).order("created_at", { ascending: false }),
      sb.from("jobs").select("ticket, status, issue, reason, closed_at, created_at").eq("scooter_id", scooterId).order("created_at", { ascending: false }).limit(10),
    ]);
    if (sc.error || !sc.data) { setErr("Couldn't load this scooter."); return; }
    setS(sc.data as Scooter);
    setRider((rd.data as Rider) ?? null);
    const ps = (pl.data ?? []) as SwapPlan[];
    setPlans(ps);
    setUsed(ps[0] ? String(ps[0].swaps_used) : "");
    setJobs((jb.data ?? []) as Job[]);
    const list = (pp.data ?? []) as Paper[];
    const slips = ps.filter((p) => p.slip_path).map((p) => p.slip_path!);
    const all = [...list.map((p) => p.path), ...slips];
    const urls: Record<string, string> = {};
    if (all.length) {
      const { data: signed } = await sb.storage.from("scooter-papers").createSignedUrls(all, 3600);
      (signed ?? []).forEach((x) => { if (x.path && x.signedUrl) urls[x.path] = x.signedUrl; });
    }
    setPapers(list.map((p) => ({ ...p, url: urls[p.path] ?? "" })));
    setSlips(urls);
    if (rd.data) {
      const { data: l } = await sb.from("rider_locations").select("updated_at").eq("rider_id", (rd.data as Rider).id).maybeSingle();
      setLoc(l?.updated_at ?? null);
    } else setLoc(null);
  }, [scooterId]);

  useEffect(() => { setTab("Overview"); setErr(""); setOk(""); load(); }, [load]);

  if (!scooterId) return null;
  const cur = plans[0] ?? null;
  const swapTag = expiryTag(cur?.ends_on ?? null, SWAP_SOON);
  const insTag = expiryTag(s?.insurance_to ?? null, INSURANCE_SOON);
  const lastDone = jobs.find((j) => j.status === "done");
  const openJob = jobs.find((j) => j.status === "open");
  const row = (a: string, b: ReactNode) => <div className="pt"><span className="mute">{a}</span><b style={{ textAlign: "right" }}>{b}</b></div>;
  const upload = async (bucketPath: string, file: File) => {
    const blob = await compressImage(file);
    const { error } = await createClient().storage.from("scooter-papers").upload(bucketPath, blob, { contentType: "image/jpeg" });
    if (error) throw error;
  };

  return (
    <>
      <Modal open onClose={onClose}>
        {!s ? <p className="mute">{err || "Loading…"}</p> : (
          <>
            <h2><Plate code={s.code} /> {s.reg_no ? `· ${s.reg_no}` : ""}</h2>
            <p><span className={`tag ${s.status === "workshop" ? "due" : s.status === "retired" ? "bad" : ""}`}>{STATUS[s.status] ?? s.status}</span></p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0 10px" }}>
              {(["Overview", "Swap plan", "Papers", "Handovers"] as const).map((t) => (
                <button key={t} className={`a${tab === t ? " p" : ""}`} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
            {err && <p className="lerr" role="alert">{err}</p>}
            {ok && <p className="tag" style={{ display: "inline-block" }}>{ok}</p>}

            {tab === "Overview" && (
              <>
                {row("Chassis", s.chassis_no ?? "–")}
                {row("Motor", s.motor_no ?? "–")}
                {row("Model", s.model ?? "–")}
                {row("Number plate", s.reg_no ?? "–")}
                {row("Bought on", formatDate(s.purchase_date))}
                <h2>Rider</h2>
                {rider ? (
                  <>
                    {row("Driving now", rider.full_name)}
                    {row("Mobile", rider.mobile ? <a href={`tel:${rider.mobile}`}>{rider.mobile}</a> : "–")}
                    {row("Wallet", rupees(rider.wallet_balance))}
                    {row("Next payment", formatDate(displayDue(rider.start_date, rider.wallet_balance, rider.weekly_rent)))}
                    {row("Location", loc ? `Last shared ${whenIST(loc)}` : "Not shared yet")}
                  </>
                ) : <p className="mute">No rider at the moment.</p>}
                <h2>Battery swap plan</h2>
                {cur ? (
                  <>
                    {row("Plan", `${cur.provider ?? ""} ${cur.plan_name ?? ""}`.trim() || "–")}
                    {row("Valid", `${formatDate(cur.starts_on)} → ${formatDate(cur.ends_on)}`)}
                    {row("Days left", <span className={`tag ${swapTag[0]}`}>{swapTag[1]}</span>)}
                    {cur.swaps_total != null && row("Swaps", `${cur.swaps_used} of ${cur.swaps_total} used`)}
                    {cur.kwh != null && row("kWh in plan", String(cur.kwh))}
                  </>
                ) : <p className="mute">No swap plan added. Open the Swap plan tab to add one.</p>}
                <h2>Insurance</h2>
                {row("Insurance", s.insurance_to ? `${s.insurance_company ?? ""} till ${formatDate(s.insurance_to)}` : "Not added")}
                {s.insurance_to && row("Days left", <span className={`tag ${insTag[0]}`}>{insTag[1]}</span>)}
                <h2>Service</h2>
                {openJob && row("In workshop", `${openJob.ticket}${openJob.issue ? ` · ${openJob.issue}` : ""}`)}
                {row("Last service", lastDone?.closed_at ? whenIST(lastDone.closed_at) : "Never")}
                <div className="btns" style={{ marginTop: 12 }}>
                  {owner && s.status === "available" && <button className="a d" onClick={() => setRetire(true)}>Retire scooter</button>}
                  <button className="a" onClick={() => setEdit({ chassis_no: s.chassis_no ?? "", motor_no: s.motor_no ?? "", model: s.model ?? "", reg_no: s.reg_no ?? "", purchase_date: s.purchase_date ?? "" })}>Edit details</button>
                  <button className="a p" onClick={onClose}>Close</button>
                </div>
              </>
            )}

            {tab === "Swap plan" && (
              <>
                {cur && (
                  <div className="row" style={{ display: "block" }}>
                    <b>Current plan · {`${cur.provider ?? ""} ${cur.plan_name ?? ""}`.trim() || "Swap plan"}</b> <span className={`tag ${swapTag[0]}`}>{swapTag[1]}</span>
                    <div className="mute">{formatDate(cur.starts_on)} → {formatDate(cur.ends_on)}{cur.amount != null ? ` · paid ${rupees(cur.amount)}` : ""}{cur.kwh != null ? ` · ${cur.kwh} kWh` : ""}</div>
                    {cur.swaps_total != null && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
                        <span>Swaps used</span>
                        <input type="number" value={used} onChange={(e) => setUsed(e.target.value)} style={{ maxWidth: 90, margin: 0 }} />
                        <span>of {cur.swaps_total}</span>
                        <button className="a" disabled={busy} onClick={async () => {
                          setBusy(true);
                          const { error } = await createClient().from("swap_plans").update({ swaps_used: Math.max(0, Number(used) || 0) }).eq("id", cur.id);
                          setBusy(false);
                          if (error) setErr("Couldn't save."); else { setOk("Swaps used updated."); load(); }
                        }}>Save</button>
                      </div>
                    )}
                    {cur.slip_path && slips[cur.slip_path] && <button className="a" style={{ marginTop: 8 }} onClick={() => setBig(slips[cur.slip_path!])}>View battery slip</button>}
                  </div>
                )}
                <button className="a p" onClick={() => {
                  const start = cur && cur.ends_on >= new Date().toISOString().slice(0, 10) ? cur.ends_on : new Date().toISOString().slice(0, 10);
                  const end = new Date(Date.parse(start + "T00:00:00Z") + 30 * 86400000).toISOString().slice(0, 10);
                  setPlan({ provider: cur?.provider ?? "Indofast", plan_name: cur?.plan_name ?? "", amount: cur?.amount != null ? String(cur.amount) : "", swaps_total: cur?.swaps_total != null ? String(cur.swaps_total) : "", kwh: cur?.kwh != null ? String(cur.kwh) : "", starts_on: start, ends_on: end, slip: null });
                }}>+ Add swap plan (recharge)</button>
                <h2>History</h2>
                {plans.length === 0 ? <p className="mute">No plans yet.</p> : plans.map((p) => (
                  <div className="pt" key={p.id}>
                    <span>{formatDate(p.starts_on)} → {formatDate(p.ends_on)} · {`${p.provider ?? ""} ${p.plan_name ?? ""}`.trim()}</span>
                    <b>{p.amount != null ? rupees(p.amount) : ""}{p.swaps_total != null ? ` · ${p.swaps_used}/${p.swaps_total} swaps` : ""}</b>
                  </div>
                ))}
              </>
            )}

            {tab === "Papers" && (
              <>
                <h2>Insurance</h2>
                {row("Company", s.insurance_company ?? "–")}
                {row("Policy no.", s.insurance_policy ?? "–")}
                {row("Valid", s.insurance_to ? `${formatDate(s.insurance_from)} → ${formatDate(s.insurance_to)}` : "Not added")}
                {s.insurance_to && row("Days left", <span className={`tag ${insTag[0]}`}>{insTag[1]}</span>)}
                <button className="a" style={{ marginTop: 8 }} onClick={() => setIns({ company: s.insurance_company ?? "", policy: s.insurance_policy ?? "", from: s.insurance_from ?? "", to: s.insurance_to ?? "" })}>Edit insurance</button>
                <h2>Papers and photos</h2>
                <label>Type of paper</label>
                <select value={paperKind} onChange={(e) => setPaperKind(e.target.value)}>
                  {PAPER_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <label style={{ display: "block", textAlign: "center", cursor: busy ? "wait" : "pointer", background: "var(--plate)", color: "#fff",
                  padding: "11px 14px", borderRadius: 10, fontWeight: 700, fontSize: 15, margin: "0 0 6px" }}>
                  {busy ? "Uploading…" : `+ Upload ${PAPER_KINDS.find(([k]) => k === paperKind)?.[1] ?? "paper"} photo`}
                  <input type="file" accept="image/*" style={{ display: "none" }} disabled={busy} onChange={async (e) => {
                    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
                    setBusy(true); setErr("");
                    try {
                      const path = taggedPath(`${s.id}/${paperKind}-${Date.now()}`, await detectSource(f));
                      await upload(path, f);
                      const { error } = await createClient().from("scooter_papers").insert({ scooter_id: s.id, kind: paperKind, path });
                      if (error) throw error;
                      setOk("Uploaded."); await load();
                    } catch { setErr("Couldn't upload. Please try again."); }
                    setBusy(false);
                  }} />
                </label>
                <p className="mute" style={{ marginTop: 0, fontSize: 13 }}>Choose the type, then tap the green button to take a photo or pick one from the gallery. You can upload several photos of each type.</p>
                {PAPER_KINDS.map(([k, l]) => {
                  const list = papers.filter((p) => p.kind === k);
                  return list.length ? (
                    <div key={k}>
                      <div className="mute" style={{ marginTop: 10 }}>{l}</div>
                      <div className="ph">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {list.map((p) => (
                          <span key={p.id} style={{ display: "inline-flex", flexDirection: "column", gap: 4, maxWidth: 150 }}>
                            <img src={p.url} alt={l} style={{ cursor: "zoom-in" }} onClick={() => setBig(p.url)} />
                            <PhotoSourceTag path={p.path} />
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })}
                {papers.length === 0 && <p className="mute">No papers uploaded yet.</p>}
              </>
            )}

            {tab === "Handovers" && <HandoverGallery scooterId={s.id} />}
          </>
        )}
      </Modal>

      <Modal open={!!edit} onClose={() => !busy && setEdit(null)}>
        {edit && s && (
          <>
            <h2>Edit {s.code}</h2>
            <label>Chassis no.</label><input value={edit.chassis_no} onChange={(e) => setEdit({ ...edit, chassis_no: e.target.value })} />
            <label>Motor no.</label><input value={edit.motor_no} onChange={(e) => setEdit({ ...edit, motor_no: e.target.value })} />
            <label>Model</label><input value={edit.model} onChange={(e) => setEdit({ ...edit, model: e.target.value })} />
            <label>Number plate</label><input value={edit.reg_no} onChange={(e) => setEdit({ ...edit, reg_no: e.target.value })} />
            <label>Bought on</label><input type="date" value={edit.purchase_date} onChange={(e) => setEdit({ ...edit, purchase_date: e.target.value })} />
            <div className="btns">
              <button className="a" onClick={() => setEdit(null)} disabled={busy}>Cancel</button>
              <button className="a p" disabled={busy} onClick={async () => {
                setBusy(true);
                const res = await updateScooter(s.id, edit);
                setBusy(false);
                if (!res.ok) { setErr(res.error); return; }
                setEdit(null); setOk("Details saved."); load(); router.refresh();
              }}>{busy ? "Saving…" : "Save details"}</button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!plan} onClose={() => !busy && setPlan(null)}>
        {plan && s && (
          <>
            <h2>New swap plan for {s.code}</h2>
            <label>Provider</label><input value={plan.provider} onChange={(e) => setPlan({ ...plan, provider: e.target.value })} />
            <label>Plan name (optional)</label><input value={plan.plan_name} onChange={(e) => setPlan({ ...plan, plan_name: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><label>Amount paid (₹)</label><input type="number" value={plan.amount} onChange={(e) => setPlan({ ...plan, amount: e.target.value })} /></div>
              <div style={{ flex: 1 }}><label>Swaps included</label><input type="number" value={plan.swaps_total} onChange={(e) => setPlan({ ...plan, swaps_total: e.target.value })} /></div>
            </div>
            <label>kWh in plan (optional)</label><input type="number" value={plan.kwh} onChange={(e) => setPlan({ ...plan, kwh: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><label>From</label><input type="date" value={plan.starts_on} onChange={(e) => setPlan({ ...plan, starts_on: e.target.value })} /></div>
              <div style={{ flex: 1 }}><label>To</label><input type="date" value={plan.ends_on} onChange={(e) => setPlan({ ...plan, ends_on: e.target.value })} /></div>
            </div>
            <label>Battery slip / plan receipt photo (optional)</label>
            <label style={{ display: "block", border: "1.5px dashed var(--mute)", borderRadius: 10, padding: 12, textAlign: "center", cursor: "pointer", color: "var(--ink)", marginBottom: 10 }}>
              {plan.slip ? `✓ ${plan.slip.name}` : "Tap to add a photo"}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setPlan({ ...plan, slip: e.target.files?.[0] ?? null })} />
            </label>
            <div className="btns">
              <button className="a" onClick={() => setPlan(null)} disabled={busy}>Cancel</button>
              <button className="a p" disabled={busy} onClick={async () => {
                if (!plan.starts_on || !plan.ends_on || plan.ends_on < plan.starts_on) { setErr("Check the From and To dates."); return; }
                setBusy(true); setErr("");
                try {
                  let slip_path: string | null = null;
                  if (plan.slip) { slip_path = taggedPath(`${s.id}/swap-slip-${Date.now()}`, await detectSource(plan.slip)); await upload(slip_path, plan.slip); }
                  const { error } = await createClient().from("swap_plans").insert({
                    scooter_id: s.id, provider: plan.provider.trim() || null, plan_name: plan.plan_name.trim() || null,
                    amount: plan.amount === "" ? null : Number(plan.amount), swaps_total: plan.swaps_total === "" ? null : Number(plan.swaps_total),
                    kwh: plan.kwh === "" ? null : Number(plan.kwh), starts_on: plan.starts_on, ends_on: plan.ends_on, slip_path,
                  });
                  if (error) throw error;
                  setPlan(null); setOk("Swap plan added."); await load(); router.refresh();
                } catch { setErr("Couldn't save the plan. Please try again."); }
                setBusy(false);
              }}>{busy ? "Saving…" : "Save plan"}</button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!ins} onClose={() => !busy && setIns(null)}>
        {ins && s && (
          <>
            <h2>Insurance for {s.code}</h2>
            <label>Insurance company</label><input value={ins.company} onChange={(e) => setIns({ ...ins, company: e.target.value })} />
            <label>Policy number</label><input value={ins.policy} onChange={(e) => setIns({ ...ins, policy: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><label>From</label><input type="date" value={ins.from} onChange={(e) => setIns({ ...ins, from: e.target.value })} /></div>
              <div style={{ flex: 1 }}><label>Valid till</label><input type="date" value={ins.to} onChange={(e) => setIns({ ...ins, to: e.target.value })} /></div>
            </div>
            <p className="note">Upload the insurance copy in Papers (choose &quot;Insurance copy&quot;).</p>
            <div className="btns">
              <button className="a" onClick={() => setIns(null)} disabled={busy}>Cancel</button>
              <button className="a p" disabled={busy} onClick={async () => {
                setBusy(true);
                const { error } = await createClient().from("scooters").update({
                  insurance_company: ins.company.trim() || null, insurance_policy: ins.policy.trim() || null,
                  insurance_from: ins.from || null, insurance_to: ins.to || null,
                }).eq("id", s.id);
                setBusy(false);
                if (error) { setErr("Couldn't save insurance."); return; }
                setIns(null); setOk("Insurance saved."); load(); router.refresh();
              }}>{busy ? "Saving…" : "Save insurance"}</button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={retire} onClose={() => !busy && setRetire(false)}>
        {s && (
          <>
            <h2>Retire {s.code}?</h2>
            <p className="mute">Use this when the scooter is sold or scrapped. It leaves the fleet, but all its history stays saved.</p>
            <div className="btns">
              <button className="a" onClick={() => setRetire(false)} disabled={busy}>Go back</button>
              <button className="a d" disabled={busy} onClick={async () => {
                setBusy(true);
                const res = await retireScooter(s.id);
                setBusy(false); setRetire(false);
                if (!res.ok) { setErr(res.error); return; }
                onClose(); router.refresh();
              }}>Yes, retire</button>
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
