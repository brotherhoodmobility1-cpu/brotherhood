"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import Plate from "./plate";
import { createClient } from "@/lib/supabase/client";
import { DOC_COUNT, DOC_GROUPS } from "@/lib/docs";
import { compressImage } from "@/lib/image";
import { detectSource, taggedPath } from "@/lib/photo-source";
import { currentPlace, stampPhoto, stampedPath } from "@/lib/stamp";
import { DOC_LABEL } from "@/lib/docs";
import { displayDue, formatDate, rupees } from "@/lib/format";
import { fillAgreement } from "@/lib/agreement";
import AgreementText from "./agreement-text";
import ReceiptModal, { type Receipt, whenIST } from "./receipt-modal";

export type RiderData = {
  id: string;
  full_name: string;
  start_date: string | null;
  weekly_rent: number;
  security_deposit: number;
  wallet_balance: number;
  late_days: number;
  action_needed: boolean;
  scooters: { code: string; chassis_no: string | null } | null;
};
export type RiderDoc = { kind: string; status: string; path: string | null; url?: string };
export type Payment = { id: number; rider_id: string; amount: number; method: string; receipt_no: string; razorpay_payment_id: string | null; utr: string | null; paid_at: string };
export type Claim = { id: number; rider_id: string; amount: number; utr: string | null; status: string; reject_reason: string | null; created_at: string };
export type Signature = { rider_id: string; version: number; body: string; signed_at: string; mobile: string | null };

/** Photos that must be taken live with the camera (stamped with date, time and place). */
const LIVE_KINDS = ["sf", "sb", "sl", "sr", "hm", "ss"];

export default function RiderApp({ riders, docs, mobile, template, signatures, payments, claims, qrUrl, upiId, openJobs, handovers }: {
  riders: RiderData[]; docs: (RiderDoc & { rider_id: string })[]; mobile: string;
  template: { version: number; body: string } | null; signatures: Signature[]; payments: Payment[];
  claims: Claim[]; qrUrl: string | null; upiId: string; openJobs: { ticket: string; rider_id: string }[];
  handovers: { id: number; rider_id: string; kind: string; created_at: string; urls: string[] }[];
}) {
  const router = useRouter();
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<"Wallet" | "Payments" | "Documents">("Wallet");
  const [busyKind, setBusyKind] = useState("");
  const [err, setErr] = useState("");
  const r = riders[sel] ?? riders[0];
  const [amount, setAmount] = useState("");
  const [pay, setPay] = useState<"" | "qr" | "proof" | "sent">("");
  const [utr, setUtr] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const myPays = payments.filter((p) => p.rider_id === r.id);
  const myClaims = claims.filter((c) => c.rider_id === r.id && c.status !== "confirmed");
  const pending = myClaims.filter((c) => c.status === "pending");
  const payAmt = Math.round(Number(amount));
  const upiLink = upiId ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent("Brotherhood Mobility")}&am=${payAmt}&cu=INR&tn=${encodeURIComponent((r.scooters?.code ?? "") + " " + r.full_name)}` : "";

  function startPay() {
    if (!(payAmt >= 1)) { setErr("Enter the amount you want to pay."); return; }
    setErr("");
    setPay("qr");
  }

  async function sendProof() {
    if (!(payAmt >= 1)) { setErr("Enter the amount you paid."); return; }
    if (!proof) { setErr("Upload the payment screenshot or receipt."); return; }
    setErr("");
    setSending(true);
    try {
      const blob = await compressImage(proof);
      const supabase = createClient();
      const path = taggedPath(`${r.id}/pay-${Date.now()}`, await detectSource(proof));
      const up = await supabase.storage.from("payment-proofs").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { error } = await supabase.from("payment_claims").insert({ rider_id: r.id, amount: payAmt, utr: utr.trim() || null, proof_path: path });
      if (error) throw error;
      setPay("sent"); setAmount(""); setUtr(""); setProof(null);
      router.refresh();
    } catch {
      setErr("Couldn't send your payment details. Please try again.");
    } finally {
      setSending(false);
    }
  }
  const myJob = openJobs.find((o) => o.rider_id === r.id) ?? null;
  const myHandover = handovers.find((h) => h.rider_id === r.id) ?? null;
  const [hoOpen, setHoOpen] = useState(false);
  const [hoBusy, setHoBusy] = useState(false);
  const [bd, setBd] = useState<"" | "form" | "sent">("");
  const [bdIssue, setBdIssue] = useState("Puncture or tyre");
  const [bdNote, setBdNote] = useState("");
  const [bdTicket, setBdTicket] = useState("");
  const [bdBusy, setBdBusy] = useState(false);

  async function reportBreakdown() {
    setBdBusy(true);
    const pos = await new Promise<GeolocationPosition | null>((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 6000 });
    });
    const { data, error } = await createClient().rpc("report_breakdown", {
      p_rider: r.id, p_issue: bdIssue, p_note: bdNote, p_lat: pos?.coords.latitude ?? null, p_lng: pos?.coords.longitude ?? null,
    });
    setBdBusy(false);
    if (error) { setErr("Couldn't send the breakdown report. Please call the office."); setBd(""); return; }
    setBdTicket(String(data)); setBdNote(""); setBd("sent");
    router.refresh();
  }
  const [sign, setSign] = useState<"" | "read" | "pw" | "done" | "view">("");
  const [agree, setAgree] = useState(false);
  const [pw, setPw] = useState("");
  const [signErr, setSignErr] = useState("");
  const [signing, setSigning] = useState(false);
  const mySig = signatures.find((s) => s.rider_id === r.id) ?? null;
  const agState = !template ? "none" : !mySig ? "none" : mySig.version < template.version ? "old" : "ok";
  const filled = template ? fillAgreement(template.body, {
    full_name: r.full_name, mobile, start_date: r.start_date, weekly_rent: r.weekly_rent,
    security_deposit: r.security_deposit, code: r.scooters?.code ?? "–", chassis: r.scooters?.chassis_no ?? null,
  }) : "";

  async function signNow() {
    if (!template) return;
    setSignErr("");
    setSigning(true);
    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: `${mobile}@users.brotherhoodmobility.in`, password: pw });
    if (authErr) { setSigning(false); setSignErr("Wrong password. Please try again."); return; }
    const { error } = await supabase.from("rider_agreements").insert({ rider_id: r.id, version: template.version, body: filled, mobile });
    setSigning(false);
    if (error) { setSignErr("Couldn't save your signature. Please try again."); return; }
    setPw(""); setAgree(false); setSign("done");
    router.refresh();
  }
  const myDocs = docs.filter((d) => d.rider_id === r.id);
  const docOf = (k: string) => myDocs.find((d) => d.kind === k);
  const uploaded = myDocs.filter((d) => d.status !== "rejected").length;
  const verified = myDocs.filter((d) => d.status === "verified").length;

  const w = Number(r.wallet_balance);
  const dep = Number(r.security_deposit);
  const rent = Number(r.weekly_rent);
  const have = Math.max(0, w);
  const pc = Math.min(100, Math.round((have / rent) * 100));
  const short = Math.max(0, Math.round(rent - w));
  const due = displayDue(r.start_date, r.wallet_balance, r.weekly_rent);
  const col = pc >= 100 ? "var(--plate)" : pc >= 40 ? "#e0a800" : "#c62828";

  async function upload(kind: string, file: File | undefined) {
    if (!file) return;
    setErr("");
    setBusyKind(kind);
    try {
      const live = LIVE_KINDS.includes(kind);
      const blob = live ? await stampPhoto(file, `${r.scooters?.code ?? ""} · ${DOC_LABEL[kind] ?? kind} · ${r.full_name}`, await currentPlace()) : await compressImage(file);
      const supabase = createClient();
      const path = live ? stampedPath(`${r.id}/${kind}-${Date.now()}`) : taggedPath(`${r.id}/${kind}-${Date.now()}`, await detectSource(file));
      const up = await supabase.storage.from("rider-docs").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { error } = await supabase.from("documents").upsert(
        { rider_id: r.id, kind, path, status: "uploaded", uploaded_at: new Date().toISOString() },
        { onConflict: "rider_id,kind" }
      );
      if (error) throw error;
      router.refresh();
    } catch {
      setErr("Couldn't upload that photo. Please try again.");
    } finally {
      setBusyKind("");
    }
  }

  return (
    <div className="phone">
      {riders.length > 1 && (
        <select value={sel} onChange={(e) => setSel(Number(e.target.value))}>
          {riders.map((x, i) => <option key={x.id} value={i}>{x.scooters?.code ?? "Scooter"}</option>)}
        </select>
      )}
      <div className="rcard">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="hi">Hi, {r.full_name.split(" ")[0]}</div>
          <div className="mute" style={{ marginTop: 6 }}>
            {r.scooters && <Plate code={r.scooters.code} />} · chassis {r.scooters?.chassis_no ?? "–"}
          </div>
        </div>
        <div className="rsc scimg" role="img" aria-label="Your scooter" />
      </div>
      {myHandover && (
        <div className="bdban" role="status" style={{ background: "var(--duebg)", borderLeftColor: "var(--lane)" }}>
          <b style={{ color: "var(--ink)" }}>Please check your scooter</b>
          <span>It was handed over to you on {whenIST(myHandover.created_at)}. </span>
          <button className="a p" style={{ marginTop: 6 }} onClick={() => setHoOpen(true)}>See photos and confirm</button>
        </div>
      )}
      {myJob && (
        <div className="bdban" role="status">
          <b>Breakdown report {myJob.ticket} registered</b>
          <span>Our staff and mechanic will contact you soon.</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, margin: "8px 0 14px" }}>
        {(["Wallet", "Payments", "Documents"] as const).map((t) => (
          <button key={t} className={`a${tab === t ? " p" : ""}`} style={{ flex: 1 }} onClick={() => setTab(t)}>
            {t}{t === "Documents" ? ` (${uploaded}/${DOC_COUNT})` : ""}
          </button>
        ))}
      </div>

      {tab === "Wallet" && (
        <>
          <div className="mute">Weekly rent</div>
          <div className="big">{rupees(rent)}</div>
          <div className="pt"><span>Next rent due</span><b>{formatDate(due)}</b></div>
          {w < 0 && (
            <p style={{ color: "var(--bad)", fontSize: 14, margin: "8px 0" }}>
              Your payment is late{r.action_needed ? "" : ` (day ${r.late_days} of 2)`}. {rupees(-w)} is pending.{" "}
              {r.action_needed ? "Please pay now. Our team will contact you." : "Please pay now to clear it."}
            </p>
          )}
          <div className="batt" role="img" aria-label={`${pc} percent of weekly rent ready`}>
            <div className="bfill" style={{ width: `${pc}%`, background: col } as CSSProperties} />
            <div className="bseg" />
            <span>{pc >= 100 ? "⚡ " : ""}{pc}% paid</span>
          </div>
          <p className="mute" style={{ margin: "0 0 6px" }}>
            {short ? `${rupees(have)} of ${rupees(rent)} paid. Pay ${rupees(short)} before ${formatDate(due)} to cover this week.` : "This week's rent is fully paid."}
          </p>
          <h2>Pay rent</h2>
          {pending.length > 0 && (
            <p className="tag due" style={{ display: "inline-block", marginBottom: 8 }}>
              {pending.length === 1 ? `${rupees(pending[0].amount)} payment waiting for confirmation` : `${pending.length} payments waiting for confirmation`}
            </p>
          )}
          <input type="number" inputMode="numeric" placeholder="Enter amount ₹" value={amount} onChange={(e) => setAmount(e.target.value)} />
          {short > 0 && !amount && (
            <button className="a" style={{ marginBottom: 8 }} onClick={() => setAmount(String(short))}>Needed {rupees(short)}</button>
          )}
          {err && tab === "Wallet" && !pay && <p className="lerr" role="alert">{err}</p>}
          <button className="a p" style={{ width: "100%" }} onClick={startPay}>Pay</button>
        </>
      )}

      {tab === "Payments" && (
        <>
          <button className="a p" style={{ width: "100%", marginBottom: 6 }} onClick={() => {
            if (!(payAmt >= 1)) { setAmount(String(short || Math.round(rent))); }
            setErr(""); setPay("proof");
          }}>Upload payment receipt</button>
          <p className="mute" style={{ marginTop: 0 }}>Already paid by QR or UPI? Upload the screenshot here.</p>
          {myClaims.length > 0 && (
            <>
              <h2>Being checked</h2>
              {myClaims.map((c) => (
                <div className="pt" key={c.id}>
                  <span>{whenIST(c.created_at)} · <b>{rupees(c.amount)}</b>{c.utr ? <small className="mute"> · UPI ref {c.utr}</small> : null}</span>
                  <span className={`tag ${c.status === "pending" ? "due" : "bad"}`}>
                    {c.status === "pending" ? "Waiting for confirmation" : `Not accepted${c.reject_reason ? `: ${c.reject_reason}` : ""}`}
                  </span>
                </div>
              ))}
            </>
          )}
          <h2>My payments</h2>
          {myPays.length === 0 ? (
            <p className="mute">No confirmed payments yet. Once our team confirms a payment, it appears here with its receipt.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="tb">
                <thead><tr><th>Date</th><th>Amount</th><th>Paid by</th><th>Receipt</th></tr></thead>
                <tbody>
                  {myPays.map((p) => (
                    <tr key={p.id}>
                      <td>{whenIST(p.paid_at)}</td>
                      <td><b>{rupees(p.amount)}</b></td>
                      <td>{p.method === "cash" ? "Cash" : "UPI"}{p.utr ? <><br /><code style={{ fontSize: 12 }}>{p.utr}</code></> : null}</td>
                      <td><button className="a" onClick={() => setReceipt({ ...p, rider: r.full_name, code: r.scooters?.code })}>{p.receipt_no}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "Documents" && (
        <>
          <p>
            <span className={`tag ${verified === DOC_COUNT ? "" : "due"}`}>
              {verified === DOC_COUNT ? "All documents verified" : `${verified} of ${DOC_COUNT} verified · ${uploaded} uploaded`}
            </span>
          </p>
          <p className="mute">Once our team verifies a document, it is locked and can&apos;t be changed.</p>
          {err && <p className="lerr" role="alert">{err}</p>}
          {DOC_GROUPS.map((g) => (
            <div key={g.title}>
              <h2>{g.title}</h2>
              {g.items.map(([k, label]) => {
                const d = docOf(k);
                const st = d?.status === "verified" ? ["Verified", "ev"] : d?.status === "uploaded" ? ["Waiting for verification", "due"]
                  : d?.status === "rejected" ? ["Rejected, please upload again", "bad"] : ["Pending", "due"];
                return (
                  <div className="pt" key={k}>
                    <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {d?.url && d.status !== "rejected" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.url} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8 }} />
                      ) : (
                        <span style={{ width: 52, height: 52, border: "1px dashed var(--mute)", borderRadius: 8, display: "inline-block", flex: "none" }} />
                      )}
                      <span>{label}<br /><small style={{ color: `var(--${st[1]})` }}>{busyKind === k ? "Uploading…" : st[0]}</small></span>
                    </span>
                    {d?.status === "verified" ? (
                      <span className="tag">Locked</span>
                    ) : (
                      <label style={{ border: "1px solid var(--line)", padding: "6px 11px", borderRadius: 8, cursor: "pointer", color: "var(--ink)", fontSize: 13, fontWeight: 600, margin: 0, display: "inline-block", flex: "none" }}>
                        {d && d.status !== "rejected" ? "Retake" : "Upload"}
                        <input type="file" accept="image/*" style={{ display: "none" }} {...(LIVE_KINDS.includes(k) ? { capture: (k === "ss" ? "user" : "environment") as "user" | "environment" } : {})}
                          disabled={!!busyKind} onChange={(e) => { upload(k, e.target.files?.[0]); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <h2>Rental agreement</h2>
          <div className="pt">
            <span><span className={`tag ${agState === "ok" ? "" : "due"}`}>
              {agState === "ok" ? `Signed ${new Date(mySig!.signed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Asia/Kolkata" })}` : agState === "old" ? "Old version, sign again" : "Not signed"}
            </span></span>
            {mySig && <button className="a" onClick={() => setSign("view")}>View signed</button>}
          </div>
          {agState !== "ok" && template && (
            <button className="a p" style={{ width: "100%", marginTop: 8 }} onClick={() => setSign("read")}>
              {agState === "old" ? "Agreement updated: read and sign again" : "Read and sign agreement / अनुबंध पढ़ें और साइन करें"}
            </button>
          )}
          <p className="note">Scooter, helmet and selfie photos open the camera and are stamped with the date, time and place. Documents can be taken with the camera or chosen from the gallery. Photos are only for Brotherhood Mobility and are kept private.</p>
        </>
      )}

      <Modal open={sign === "read"} onClose={() => setSign("")}>
        <AgreementText text={filled} />
        <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink)", fontSize: 14, margin: "10px 0" }}>
          <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          I have read this agreement and I agree to it / मैंने यह अनुबंध पढ़ लिया है और मैं इससे सहमत हूँ
        </label>
        {signErr && <p className="lerr" role="alert">{signErr}</p>}
        <div className="btns">
          <button className="a" onClick={() => setSign("")}>Cancel</button>
          <button className="a p" onClick={() => (agree ? (setSignErr(""), setSign("pw")) : setSignErr("Please tick that you have read and agree to the agreement."))}>
            Continue to sign / आगे बढ़ें
          </button>
        </div>
      </Modal>
      <Modal open={sign === "pw"} onClose={() => !signing && setSign("")}>
        <h2>Confirm with your password / पासवर्ड से पुष्टि करें</h2>
        <p className="mute">Enter your login password to sign this agreement.</p>
        <input type="password" autoComplete="current-password" placeholder="Your password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {signErr && <p className="lerr" role="alert">{signErr}</p>}
        <div className="btns">
          <button className="a" onClick={() => setSign("read")} disabled={signing}>Back</button>
          <button className="a p" onClick={signNow} disabled={signing}>{signing ? "Signing…" : "Sign agreement"}</button>
        </div>
      </Modal>
      <Modal open={sign === "done"} onClose={() => setSign("")}>
        <div className="okm">
          <div className="okc"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
          <h2>Agreement signed</h2>
          <p>Thank you, {r.full_name.split(" ")[0]}. A copy is saved in your Documents tab.</p>
          <div className="btns" style={{ justifyContent: "center" }}><button className="a p" onClick={() => setSign("")}>Close</button></div>
        </div>
      </Modal>
      <Modal open={sign === "view"} onClose={() => setSign("")}>
        {mySig && (
          <>
            <AgreementText text={mySig.body} />
            <div className="row" style={{ display: "block", marginTop: 10 }}>
              <b>Signed electronically</b>
              <small className="mute" style={{ display: "block" }}>
                By {r.full_name} · mobile {mySig.mobile ?? "(not set)"} · {new Date(mySig.signed_at).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} · confirmed with password · version {mySig.version}
              </small>
            </div>
            <div className="btns"><button className="a p" onClick={() => setSign("")}>Close</button></div>
          </>
        )}
      </Modal>
      <Modal open={pay === "qr"} onClose={() => setPay("")}>
        <h2>Pay {rupees(payAmt)}</h2>
        <p className="mute">Scan this QR code with any UPI app (Google Pay, PhonePe, Paytm) and pay exactly {rupees(payAmt)}.</p>
        {qrUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrUrl} alt="Brotherhood Mobility payment QR code" style={{ width: "100%", maxWidth: 280, display: "block", margin: "8px auto", borderRadius: 12, background: "#fff", padding: 8 }} />
        ) : (
          <p className="lerr">The payment QR code isn&apos;t set up yet. Please pay at the office.</p>
        )}
        {upiId && <div className="pt"><span className="mute">UPI ID</span><b>{upiId}</b></div>}
        {upiLink && <a className="a" href={upiLink} style={{ display: "block", textAlign: "center", textDecoration: "none", padding: 10, border: "1.5px solid var(--line)", borderRadius: 10, margin: "10px 0 0" }}>Open my UPI app</a>}
        <div className="btns" style={{ marginTop: 12 }}>
          <button className="a" onClick={() => setPay("")}>Cancel</button>
          <button className="a p" onClick={() => { setErr(""); setPay("proof"); }}>I&apos;ve paid, upload receipt</button>
        </div>
      </Modal>
      <Modal open={pay === "proof"} onClose={() => !sending && setPay("")}>
        <h2>Upload payment receipt</h2>
        <p className="mute">Add the screenshot from your UPI app showing the payment. Our team checks it and adds it to your account.</p>
        <label>Amount paid (₹)</label>
        <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <label>Payment screenshot</label>
        <label style={{ display: "block", border: "1.5px dashed var(--mute)", borderRadius: 10, padding: 14, textAlign: "center", cursor: "pointer", color: "var(--ink)", marginBottom: 10 }}>
          {proof ? `✓ ${proof.name}` : "Tap to choose the screenshot"}
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
        </label>
        <label>UPI reference / transaction ID (optional)</label>
        <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="12-digit UPI reference" />
        {err && <p className="lerr" role="alert">{err}</p>}
        <div className="btns">
          <button className="a" onClick={() => setPay("qr")} disabled={sending}>Back</button>
          <button className="a p" onClick={sendProof} disabled={sending}>{sending ? "Sending…" : "Send for confirmation"}</button>
        </div>
      </Modal>
      <Modal open={pay === "sent"} onClose={() => setPay("")}>
        <div className="okm">
          <div className="okc"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
          <h2>Payment sent for confirmation</h2>
          <p>Thank you. Our team will check your receipt and add the payment to your account shortly.</p>
          <p className="hin" lang="hi">आपकी पेमेंट रसीद मिल गई है। हमारी टीम जाँच करके जल्द ही आपके वॉलेट में राशि जोड़ देगी।</p>
          <div className="btns" style={{ justifyContent: "center" }}><button className="a p" onClick={() => setPay("")}>Okay</button></div>
        </div>
      </Modal>
      <ReceiptModal r={receipt} onClose={() => setReceipt(null)} />
      <Modal open={hoOpen} onClose={() => !hoBusy && setHoOpen(false)}>
        {myHandover && (
          <>
            <h2>Scooter handover</h2>
            <p className="mute">These photos show the scooter&apos;s condition when you received it. Please check them.</p>
            <div className="ph">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {myHandover.urls.map((u) => <img key={u} src={u} alt="" style={{ width: 96, height: 96 }} />)}
            </div>
            <p className="hin" lang="hi">कृपया फ़ोटो देखें। अगर स्कूटर ठीक हालत में मिला है तो नीचे पुष्टि करें।</p>
            <div className="btns">
              <button className="a" onClick={() => setHoOpen(false)} disabled={hoBusy}>Later</button>
              <button className="a p" disabled={hoBusy} onClick={async () => {
                setHoBusy(true);
                await createClient().rpc("confirm_handover", { p_id: myHandover.id });
                setHoBusy(false); setHoOpen(false); router.refresh();
              }}>{hoBusy ? "Saving…" : "I received the scooter in good condition"}</button>
            </div>
            <p className="note">If something is damaged or missing, call the office before confirming.</p>
          </>
        )}
      </Modal>
      <Modal open={bd === "form"} onClose={() => !bdBusy && setBd("")}>
        <h2>Report breakdown</h2>
        <p className="mute">{r.scooters?.code} · chassis {r.scooters?.chassis_no ?? "–"}</p>
        <label>What is the problem?</label>
        <select value={bdIssue} onChange={(e) => setBdIssue(e.target.value)}>
          {["Puncture or tyre", "Brakes", "Battery or charging", "Lights or horn", "Motor or throttle", "Accident damage", "Tyre worn out", "Other"].map((o) => <option key={o}>{o}</option>)}
        </select>
        <label>Details (optional)</label>
        <textarea rows={2} placeholder="Where are you, what happened" value={bdNote} onChange={(e) => setBdNote(e.target.value)} />
        <div className="btns">
          <button className="a" onClick={() => setBd("")} disabled={bdBusy}>Cancel</button>
          <button className="a d" onClick={reportBreakdown} disabled={bdBusy}>{bdBusy ? "Sending…" : "Report breakdown"}</button>
        </div>
      </Modal>
      <Modal open={bd === "sent"} onClose={() => setBd("")}>
        <div className="okm">
          <div className="okc"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
          <h2>{myJob && !bdTicket ? "Report already registered" : "Breakdown report registered"}</h2>
          <p className="tkt">Report no. <b>{bdTicket || myJob?.ticket}</b> · {r.scooters?.code}</p>
          <p>Thank you for letting us know, {r.full_name.split(" ")[0]}. Our staff and mechanic will contact you soon{mobile ? ` on ${mobile}` : ""}.</p>
          <p className="mute">Please park the scooter in a safe place and keep your phone switched on.</p>
          <p className="hin" lang="hi">आपकी ब्रेकडाउन रिपोर्ट दर्ज हो गई है। हमारा स्टाफ और मैकेनिक जल्द ही आपसे संपर्क करेंगे। धन्यवाद!</p>
          <div className="btns" style={{ justifyContent: "center" }}><button className="a p" onClick={() => { setBd(""); setBdTicket(""); }}>Okay, thank you</button></div>
        </div>
      </Modal>
      <button className="fab" onClick={() => (myJob ? setBd("sent") : setBd("form"))}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: -3, marginRight: 7 }} aria-hidden="true">
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
        </svg>Report breakdown
      </button>
    </div>
  );
}
