"use server";

import { getMe } from "@/lib/me";
import { morningData, runMorning } from "@/lib/morning";
import { TPL, sendTemplate } from "@/lib/whatsapp";

const KEYS = ["push_on", "wa_rider_due", "wa_rider_late", "wa_rider_receipt", "wa_team_list", "wa_owner_report"];

export async function setAutomation(key: string, on: boolean) {
  const me = await getMe();
  if (me?.role !== "owner") return { ok: false, error: "Only an owner can change this." };
  if (!KEYS.includes(key)) return { ok: false, error: "Unknown setting." };
  const { error } = await me.supabase.from("app_settings").upsert({ key, value: on ? "on" : "off" }, { onConflict: "key" });
  return error ? { ok: false, error: error.message } : { ok: true, error: "" };
}

export async function runNow() {
  const me = await getMe();
  if (me?.role !== "owner") return { ok: false, error: "Only an owner can do this.", summary: "" };
  if (!process.env.SUPABASE_SECRET_KEY) return { ok: false, error: "SUPABASE_SECRET_KEY is missing in Vercel.", summary: "" };
  const r = await runMorning();
  return {
    ok: true, error: "",
    summary: `${r.due} riders due today, ${r.late} late. Sent: ${r.sent.owner} owner reports (to ${r.owners.join(" and ")}), ${r.sent.team} staff lists, ${r.sent.riderDue} payment-day, ${r.sent.riderLate} late. Failed: ${r.sent.failed}. (Messages already sent today are not sent again.)`,
  };
}

export async function sendTestToMe() {
  const me = await getMe();
  if (me?.role !== "owner") return { ok: false, error: "Only an owner can do this." };
  const { data: p } = await me.supabase.from("profiles").select("full_name, mobile").eq("id", me.id).single();
  if (!p) return { ok: false, error: "Profile not found." };
  // A real report with today's figures, sent only to you (can be sent again any time)
  const d = await morningData();
  const res = await sendTemplate({ mobile: p.mobile, name: p.full_name, template: TPL.ownerReport, params: d.ownerParams(p.full_name.split(" ")[0]) });
  return res.ok ? { ok: true, error: "" } : { ok: false, error: res.error ?? "Couldn't send." };
}
