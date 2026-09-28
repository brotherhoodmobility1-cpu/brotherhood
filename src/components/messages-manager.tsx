"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runNow, sendTestToMe, setAutomation } from "@/app/messages/actions";
import { whenIST } from "@/lib/ist";
import { formatDate } from "@/lib/format";

export type LogRow = { id: number; to_mobile: string; to_name: string | null; template: string; status: string; error: string | null; created_at: string };

const AUTOS: [string, string, string][] = [
  ["push_on", "App notifications to riders (free)", "Payment day and late reminders at 7 AM, payment received, scooter ready · only on phones where the rider tapped Allow reminders"],
  ["wa_rider_due", "Payment day message to riders (with QR)", "7 AM · riders whose weekly payment is due today and not yet paid · sent a few seconds apart"],
  ["wa_rider_late", "Late payment reminder to riders (with QR)", "7 AM · riders whose wallet is in minus"],
  ["wa_rider_receipt", "Payment received message to riders", "As soon as a payment is confirmed or recorded · amount, receipt no. and next payment day"],
  ["wa_team_list", "Collection list to owners and staff", "7 AM · who pays today and who is late, with amounts"],
  ["wa_owner_report", "Daily report to owners", "7 AM · collected yesterday and last 7 days, rent earned, dues, fleet in use, breakdowns, swap plans and insurance ending"],
];
const NAMES: Record<string, string> = {
  bm_payment_day: "Payment day", bm_payment_late: "Late reminder", bm_payment_received: "Payment received",
  bm_team_collection: "Team collection list", bm_owner_report: "Owner report",
  push_due: "App notification · payment day", push_late: "App notification · late", push_receipt: "App notification · payment received",
  push_handover: "App notification · scooter ready", push_repaired: "App notification · scooter repaired",
};

export default function MessagesManager({ configured, provider, cron, on, log, day, today }: { configured: boolean; provider: string; cron: boolean; on: Record<string, boolean>; log: LogRow[]; day: string; today: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function toggle(k: string, v: boolean) {
    setBusy(k); setErr("");
    const r = await setAutomation(k, v);
    setBusy("");
    if (!r.ok) setErr(r.error); else router.refresh();
  }

  return (
    <>
      <h2>Automatic WhatsApp messages</h2>
      <div className="row" style={{ display: "block" }}>
        <div className="pt"><span>WhatsApp connection</span><span className={`tag ${configured ? "" : "bad"}`}>{configured ? `Connected · ${provider}` : "Not connected yet"}</span></div>
        <div className="pt"><span>Daily 7 AM schedule</span><span className={`tag ${cron ? "" : "bad"}`}>{cron ? "Ready" : "CRON_SECRET missing"}</span></div>
        {!configured && <p className="mute" style={{ marginBottom: 0 }}>Messages are saved in the log below as &quot;skipped&quot; until WhatsApp is connected. Add EVOLUTION_URL, EVOLUTION_API_KEY and EVOLUTION_INSTANCE in Vercel, then redeploy.</p>}
      </div>
      {err && <p className="lerr" role="alert">{err}</p>}
      {msg && <p className="tag" style={{ display: "inline-block", whiteSpace: "normal" }}>{msg}</p>}

      {AUTOS.map(([k, title, sub]) => (
        <div className="row" key={k}>
          <div className="m"><b>{title}</b><small>{sub}</small></div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink)", fontSize: 14, margin: 0 }}>
            <input type="checkbox" style={{ width: 22, height: 22, margin: 0 }} checked={!!on[k]} disabled={busy === k} onChange={(e) => toggle(k, e.target.checked)} />
            {on[k] ? "On" : "Off"}
          </label>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button className="a" disabled={!!busy} onClick={async () => {
          setBusy("test"); setErr(""); setMsg("");
          const r = await sendTestToMe();
          setBusy("");
          if (!r.ok) setErr(r.error); else setMsg("Test report sent to your WhatsApp.");
          router.refresh();
        }}>{busy === "test" ? "Sending…" : "Send a test report to me"}</button>
        <button className="a p" disabled={!!busy} onClick={async () => {
          if (!confirm("Send today's morning messages now? Anyone who already got today's message won't get it again.")) return;
          setBusy("run"); setErr(""); setMsg("");
          const r = await runNow();
          setBusy("");
          if (!r.ok) setErr(r.error); else setMsg(r.summary);
          router.refresh();
        }}>{busy === "run" ? "Sending…" : "Send today's morning messages now"}</button>
      </div>

      <h2>Message log</h2>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input type="date" value={day} max={today} style={{ maxWidth: 190, margin: 0 }}
          onChange={(e) => e.target.value && router.push(e.target.value === today ? "/messages" : `/messages?date=${e.target.value}`)} />
        {day !== today && <button className="a" onClick={() => router.push("/messages")}>Back to today</button>}
      </div>
      <p className="mute" style={{ marginTop: 8 }}>
        {day === today ? "Today" : formatDate(day)} · {log.filter((l) => l.status === "sent").length} sent · {log.filter((l) => l.status === "failed").length} failed · {log.filter((l) => l.status === "skipped").length} skipped
      </p>
      {log.length === 0 ? <p className="mute">No messages on this day.</p> : (
        <div style={{ overflowX: "auto" }}>
          <table className="tb">
            <thead><tr><th>Time</th><th>To</th><th>Message</th><th>Status</th></tr></thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td>{whenIST(l.created_at)}</td>
                  <td>{l.to_name ?? ""}<br /><small className="mute">{l.to_mobile}</small></td>
                  <td>{NAMES[l.template] ?? l.template}</td>
                  <td><span className={`tag ${l.status === "sent" ? "" : l.status === "failed" ? "bad" : "due"}`}>{l.status === "sent" ? "Sent" : l.status === "failed" ? "Failed" : "Skipped"}</span>
                    {l.error && <><br /><small className="mute">{l.error}</small></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
