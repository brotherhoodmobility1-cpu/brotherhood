"use client";

import { useEffect, useState } from "react";
import { saveSubscription } from "@/app/push/actions";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const LATER = "bm-push-later";

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function subscribe() {
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
  await saveSubscription(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }, navigator.userAgent);
}

/** Asks riders once to turn on reminders. If already allowed, quietly keeps this phone registered. */
export default function PushPrompt() {
  const [show, setShow] = useState<"" | "ask" | "blocked">("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!KEY || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "granted") { subscribe().catch(() => {}); return; }
    if (Notification.permission === "denied") { setShow("blocked"); return; }
    let later = 0;
    try { later = Number(localStorage.getItem(LATER) || 0); } catch { /* storage off */ }
    if (Date.now() - later > 3 * 86400000) setShow("ask");
  }, []);

  if (!show) return null;
  if (show === "blocked") {
    return (
      <div className="row" style={{ display: "block", marginBottom: 10 }}>
        <b>Payment reminders are blocked</b>
        <small className="mute" style={{ display: "block" }}>
          To get reminders, allow notifications for Brotherhood Mobility in your phone settings (Settings → Apps → Brotherhood → Notifications).
        </small>
      </div>
    );
  }
  return (
    <div className="bdban" role="status" style={{ background: "var(--duebg)", borderLeftColor: "var(--lane)" }}>
      <b style={{ color: "var(--ink)" }}>Turn on payment reminders</b>
      <span>Get a reminder on your payment day, and a message when your payment is received.</span>
      <span className="hin" lang="hi" style={{ display: "block", marginTop: 4 }}>भुगतान के दिन रिमाइंडर और भुगतान मिलने पर संदेश पाने के लिए नोटिफिकेशन चालू करें।</span>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="a p" disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            const p = await Notification.requestPermission();
            if (p === "granted") { await subscribe(); setShow(""); } else setShow(p === "denied" ? "blocked" : "");
          } catch { setShow(""); }
          setBusy(false);
        }}>{busy ? "Turning on…" : "Allow reminders"}</button>
        <button className="a" onClick={() => { try { localStorage.setItem(LATER, String(Date.now())); } catch { /* ignore */ } setShow(""); }}>Later</button>
      </div>
    </div>
  );
}
