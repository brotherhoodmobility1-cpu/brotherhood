"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import Plate from "./plate";
import { createClient } from "@/lib/supabase/client";
import { DOC_COUNT, DOC_GROUPS } from "@/lib/docs";
import { compressImage } from "@/lib/image";
import { formatDate, nextDue, rupees } from "@/lib/format";

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

export default function RiderApp({ riders, docs }: { riders: RiderData[]; docs: (RiderDoc & { rider_id: string })[] }) {
  const router = useRouter();
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<"Wallet" | "Payments" | "Documents">("Wallet");
  const [info, setInfo] = useState("");
  const [busyKind, setBusyKind] = useState("");
  const [err, setErr] = useState("");
  const r = riders[sel] ?? riders[0];
  const myDocs = docs.filter((d) => d.rider_id === r.id);
  const docOf = (k: string) => myDocs.find((d) => d.kind === k);
  const uploaded = myDocs.filter((d) => d.status !== "rejected").length;
  const verified = myDocs.filter((d) => d.status === "verified").length;

  const w = Number(r.wallet_balance);
  const dep = Number(r.security_deposit);
  const used = w < 0 ? Math.min(dep, -w) : 0;
  const rent = Number(r.weekly_rent);
  const have = Math.max(0, w);
  const pc = Math.min(100, Math.round((have / rent) * 100));
  const short = Math.max(0, rent - have);
  const due = nextDue(r.start_date);
  const col = pc >= 100 ? "var(--plate)" : pc >= 40 ? "#e0a800" : "#c62828";

  async function upload(kind: string, file: File | undefined) {
    if (!file) return;
    setErr("");
    setBusyKind(kind);
    try {
      const blob = await compressImage(file);
      const supabase = createClient();
      const path = `${r.id}/${kind}-${Date.now()}.jpg`;
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
      <div style={{ display: "flex", gap: 6, margin: "8px 0 14px" }}>
        {(["Wallet", "Payments", "Documents"] as const).map((t) => (
          <button key={t} className={`a${tab === t ? " p" : ""}`} style={{ flex: 1 }} onClick={() => setTab(t)}>
            {t}{t === "Documents" ? ` (${uploaded}/${DOC_COUNT})` : ""}
          </button>
        ))}
      </div>

      {tab === "Wallet" && (
        <>
          <div className="mute">Wallet balance</div>
          <div className="big" style={{ color: w < 0 ? "var(--bad)" : "var(--ink)" }}>{rupees(w)}</div>
          {w < 0 && (
            <p style={{ color: "var(--bad)", fontSize: 14, margin: "6px 0" }}>
              Your wallet is running in minus{r.action_needed ? "" : ` (day ${r.late_days} of 2)`}. {rupees(used)} has been taken from your security deposit.{" "}
              {r.action_needed ? "Please recharge now. Our team will contact you." : "Recharge now to clear it."}
            </p>
          )}
          <div className="pt">
            <span>Security deposit</span>
            <b>{rupees(dep - used)}{used ? <small style={{ color: "var(--bad)" }}> ({rupees(used)} used)</small> : null}</b>
          </div>
          <h2>Weekly rent {rupees(rent)}</h2>
          <div className="pt"><span>Next rent due</span><b>{formatDate(due)}</b></div>
          <div className="batt" role="img" aria-label={`${pc} percent of weekly rent ready`}>
            <div className="bfill" style={{ width: `${pc}%`, background: col } as CSSProperties} />
            <div className="bseg" />
            <span>{pc >= 100 ? "⚡ " : ""}{pc}% charged</span>
          </div>
          <p className="mute" style={{ margin: "0 0 6px" }}>
            {short ? `${rupees(have)} of ${rupees(rent)} ready. Add ${rupees(short)} before ${formatDate(due)} to fully charge.` : "Fully charged for this week's rent."}
          </p>
          <h2>Recharge wallet</h2>
          <input type="number" placeholder="Enter amount ₹" />
          <button className="a p" style={{ width: "100%" }} onClick={() => setInfo("recharge")}>Recharge</button>
        </>
      )}

      {tab === "Payments" && (
        <>
          <h2>My payments</h2>
          <p className="mute">No payments yet. Your recharges will appear here with their receipt and payment ID.</p>
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
                        <input type="file" accept="image/*" capture={k === "ss" ? "user" : "environment"} style={{ display: "none" }}
                          disabled={!!busyKind} onChange={(e) => upload(k, e.target.files?.[0])} />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <h2>Rental agreement</h2>
          <p className="mute">You&apos;ll read and sign your rental agreement here in the app soon.</p>
          <p className="note">On a phone, Upload opens the camera. Photos are only for Brotherhood Mobility and are kept private.</p>
        </>
      )}

      <Modal open={info === "recharge"} onClose={() => setInfo("")}>
        <h2>Online recharge opens soon</h2>
        <p>Until then, pay at the Brotherhood Mobility office and our staff will add it to your wallet.</p>
        <div className="btns"><button className="a p" onClick={() => setInfo("")}>Okay</button></div>
      </Modal>
    </div>
  );
}
