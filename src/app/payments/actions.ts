"use server";

import { getMe } from "@/lib/me";
import { notifyPaymentReceived } from "@/lib/morning";

type Res = { ok: boolean; error: string; receipt: string };
const team = (r?: string) => !!r && ["owner", "staff"].includes(r);

export async function confirmClaim(id: number): Promise<Res> {
  const me = await getMe();
  if (!team(me?.role)) return { ok: false, error: "Only owner or staff can confirm payments.", receipt: "" };
  const { data: claim } = await me!.supabase.from("payment_claims").select("rider_id, amount").eq("id", id).single();
  const { data, error } = await me!.supabase.rpc("confirm_claim", { p_claim: id });
  if (error) return { ok: false, error: error.message, receipt: "" };
  if (claim) await notifyPaymentReceived(claim.rider_id, Number(claim.amount), String(data));
  return { ok: true, error: "", receipt: String(data) };
}

export async function rejectClaim(id: number, reason: string): Promise<Res> {
  const me = await getMe();
  if (!team(me?.role)) return { ok: false, error: "Only owner or staff can reject payments.", receipt: "" };
  const { error } = await me!.supabase.rpc("reject_claim", { p_claim: id, p_reason: reason });
  return error ? { ok: false, error: error.message, receipt: "" } : { ok: true, error: "", receipt: "" };
}

export async function recordPayment(riderId: string, amount: number, method: "cash" | "upi", ref: string, proofPath?: string): Promise<Res> {
  const me = await getMe();
  if (!team(me?.role)) return { ok: false, error: "Only owner or staff can record payments.", receipt: "" };
  const amt = Math.round(Number(amount));
  if (!(amt > 0)) return { ok: false, error: "Enter an amount.", receipt: "" };
  const { data, error } = await me!.supabase.rpc("record_payment_with_proof", { p_rider: riderId, p_amount: amt, p_method: method, p_ref: ref, p_proof: proofPath ?? null });
  if (error) return { ok: false, error: error.message, receipt: "" };
  await notifyPaymentReceived(riderId, amt, String(data));
  return { ok: true, error: "", receipt: String(data) };
}

export async function adjustWallet(riderId: string, amount: number, note: string): Promise<Res> {
  const me = await getMe();
  if (me?.role !== "owner") return { ok: false, error: "Only an owner can adjust wallets.", receipt: "" };
  const amt = Math.round(Number(amount));
  if (!amt) return { ok: false, error: "Enter an amount (use minus for a deduction).", receipt: "" };
  const { error } = await me.supabase.rpc("adjust_wallet", { p_rider: riderId, p_amount: amt, p_note: note.trim() || "Adjustment" });
  return error ? { ok: false, error: error.message, receipt: "" } : { ok: true, error: "", receipt: "" };
}

export async function saveUpiSettings(upiId: string, qrUpdated: boolean): Promise<Res> {
  const me = await getMe();
  if (me?.role !== "owner") return { ok: false, error: "Only an owner can change payment details.", receipt: "" };
  const rows = [{ key: "upi_id", value: upiId.trim() }];
  if (qrUpdated) rows.push({ key: "qr_version", value: String(Date.now()) });
  const { error } = await me.supabase.from("app_settings").upsert(rows, { onConflict: "key" });
  return error ? { ok: false, error: error.message, receipt: "" } : { ok: true, error: "", receipt: "" };
}
