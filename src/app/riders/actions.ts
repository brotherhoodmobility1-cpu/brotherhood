"use server";

import { getMe } from "@/lib/me";
import { createAdminClient } from "@/lib/supabase/admin";
import { tempPassword } from "@/lib/passwords";

export type ActionResult = { ok: true; message?: string; name?: string; mobile?: string; password?: string } | { ok: false; error: string };

const emailFor = (m: string) => `${m}@users.brotherhoodmobility.in`;
const clean = (m: string) => m.replace(/\D/g, "").slice(-10);
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export async function authoriseRider(name: string, mobileRaw: string, rent: number, deposit: number, enquiryId?: number): Promise<ActionResult> {
  const me = await getMe();
  if (me?.role !== "owner") return { ok: false, error: "Only an owner can authorise riders." };
  const mobile = clean(mobileRaw);
  if (!name.trim() || mobile.length !== 10) return { ok: false, error: "Enter the name and a 10-digit mobile number." };
  if (!(rent > 0) || !(deposit >= 0)) return { ok: false, error: "Enter the weekly rent and security deposit." };
  const admin = createAdminClient();
  const { data: taken } = await admin.from("profiles").select("id").eq("mobile", mobile).maybeSingle();
  if (taken) return { ok: false, error: "This mobile number already has a login." };

  const password = tempPassword();
  const { data, error } = await admin.auth.admin.createUser({ email: emailFor(mobile), password, email_confirm: true });
  if (error || !data.user) return { ok: false, error: error?.message ?? "Couldn't create the login." };
  const uid = data.user.id;
  const { error: pe } = await admin.from("profiles").insert({ id: uid, full_name: name.trim(), mobile, role: "rider", must_change_password: true });
  if (pe) { await admin.auth.admin.deleteUser(uid); return { ok: false, error: pe.message }; }
  const { error: re } = await admin.from("riders").insert({
    profile_id: uid, full_name: name.trim(), mobile, weekly_rent: rent, security_deposit: deposit, status: "waiting",
  });
  if (re) { await admin.auth.admin.deleteUser(uid); return { ok: false, error: re.message }; }
  if (enquiryId) await admin.from("enquiries").update({ status: "approved" }).eq("id", enquiryId);
  return { ok: true, name: name.trim(), mobile, password, message: "Rider authorised." };
}

export async function removeWaiting(riderId: string): Promise<ActionResult> {
  const me = await getMe();
  if (me?.role !== "owner") return { ok: false, error: "Only an owner can do this." };
  const admin = createAdminClient();
  const { data: r } = await admin.from("riders").select("profile_id, status").eq("id", riderId).single();
  if (!r || r.status !== "waiting") return { ok: false, error: "Only waiting riders can be removed." };
  await admin.from("riders").delete().eq("id", riderId);
  if (r.profile_id) {
    const { count } = await admin.from("riders").select("*", { count: "exact", head: true }).eq("profile_id", r.profile_id);
    if (!count) await admin.auth.admin.deleteUser(r.profile_id);
  }
  return { ok: true };
}

export async function allotScooter(riderId: string, scooterId: number, startDate: string, depositReceived: boolean): Promise<ActionResult> {
  const me = await getMe();
  if (!me || !["owner", "staff"].includes(me.role)) return { ok: false, error: "Only owner or staff can allot scooters." };
  if (!depositReceived) return { ok: false, error: "Tick that the security deposit has been received." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { ok: false, error: "Choose a start date." };
  const { supabase } = me;
  const { data: s } = await supabase.from("scooters").select("status").eq("id", scooterId).single();
  if (s?.status !== "available") return { ok: false, error: "That scooter is no longer available." };
  const { error } = await supabase.from("riders")
    .update({ scooter_id: scooterId, start_date: startDate, status: "active", wallet_balance: 0, late_days: 0, action_needed: false })
    .eq("id", riderId).eq("status", "waiting");
  if (error) return { ok: false, error: error.message };
  await supabase.from("scooters").update({ status: "rented" }).eq("id", scooterId);
  return { ok: true };
}

export async function returnScooter(riderId: string, charges: number, note: string, photos: string[], toMechanic: boolean): Promise<ActionResult> {
  const me = await getMe();
  if (!me || !["owner", "staff"].includes(me.role)) return { ok: false, error: "Only owner or staff can take returns." };
  if (photos.length < 4) return { ok: false, error: "Add all 4 photos of the returned scooter." };
  const admin = createAdminClient();
  const { data: r } = await admin.from("riders")
    .select("profile_id, scooter_id, security_deposit, wallet_balance, status").eq("id", riderId).single();
  if (!r || r.status !== "active") return { ok: false, error: "This rider isn't active." };
  const chg = Math.max(0, Math.round(Number(charges) || 0));
  const settlement = Number(r.security_deposit) + Number(r.wallet_balance) - chg;
  const { error } = await admin.from("riders").update({
    status: "closed", end_date: today(), return_charges: chg, return_note: note.trim() || null,
    settlement, return_photos: photos,
  }).eq("id", riderId);
  if (error) return { ok: false, error: error.message };
  if (r.scooter_id) await admin.from("scooters").update({ status: toMechanic ? "workshop" : "available" }).eq("id", r.scooter_id);
  if (r.profile_id) {
    const { count } = await admin.from("riders").select("*", { count: "exact", head: true })
      .eq("profile_id", r.profile_id).in("status", ["active", "waiting"]);
    if (!count) await admin.auth.admin.updateUserById(r.profile_id, { ban_duration: "876000h" });
  }
  return {
    ok: true,
    message: settlement >= 0 ? `Refund ₹${settlement.toLocaleString("en-IN")} to the rider.` : `Collect ₹${(-settlement).toLocaleString("en-IN")} from the rider.`,
  };
}

export async function updateRider(riderId: string, v: { full_name: string; weekly_rent: number; security_deposit: number; start_date: string | null }): Promise<ActionResult> {
  const me = await getMe();
  if (me?.role !== "owner") return { ok: false, error: "Only an owner can edit riders." };
  if (!v.full_name.trim() || !(v.weekly_rent > 0) || !(v.security_deposit >= 0)) return { ok: false, error: "Check the name, rent and deposit." };
  const { error } = await me.supabase.from("riders").update({
    full_name: v.full_name.trim(), weekly_rent: v.weekly_rent, security_deposit: v.security_deposit, start_date: v.start_date || null,
  }).eq("id", riderId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function markScooterAvailable(scooterId: number): Promise<ActionResult> {
  const me = await getMe();
  if (!me || !["owner", "staff"].includes(me.role)) return { ok: false, error: "Only owner or staff can do this." };
  const { error } = await me.supabase.from("scooters").update({ status: "available" }).eq("id", scooterId).eq("status", "workshop");
  return error ? { ok: false, error: error.message } : { ok: true };
}
