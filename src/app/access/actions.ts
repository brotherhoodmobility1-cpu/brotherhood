"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tempPassword } from "@/lib/passwords";

type Result = { ok: true; name: string; mobile: string; password?: string; note?: string } | { ok: false; error: string };

const emailFor = (mobile: string) => `${mobile}@users.brotherhoodmobility.in`;

async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
  return me?.role === "owner" ? me : null;
}

function clean(mobile: string) {
  return mobile.replace(/\D/g, "").slice(-10);
}

export async function createTeamLogin(name: string, mobileRaw: string, role: string): Promise<Result> {
  if (!(await requireOwner())) return { ok: false, error: "Only an owner can do this." };
  const mobile = clean(mobileRaw);
  if (!name.trim() || mobile.length !== 10) return { ok: false, error: "Enter a name and a 10-digit mobile number." };
  if (!["owner", "staff"].includes(role)) return { ok: false, error: "Choose Staff or Owner." };
  const admin = createAdminClient();
  const { data: taken } = await admin.from("profiles").select("id").eq("mobile", mobile).maybeSingle();
  if (taken) return { ok: false, error: "This mobile number already has a login." };
  const password = tempPassword();
  const { data, error } = await admin.auth.admin.createUser({ email: emailFor(mobile), password, email_confirm: true });
  if (error || !data.user) return { ok: false, error: error?.message ?? "Couldn't create the login." };
  const { error: pe } = await admin.from("profiles").insert({
    id: data.user.id, full_name: name.trim(), mobile, role, must_change_password: true,
  });
  if (pe) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: pe.message };
  }
  return { ok: true, name: name.trim(), mobile, password };
}

export async function resetPassword(profileId: string): Promise<Result> {
  const me = await requireOwner();
  if (!me) return { ok: false, error: "Only an owner can do this." };
  if (me.id === profileId) return { ok: false, error: "Use Change my password for your own account." };
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("full_name, mobile").eq("id", profileId).single();
  if (!p) return { ok: false, error: "Login not found." };
  const password = tempPassword();
  const { error } = await admin.auth.admin.updateUserById(profileId, { password });
  if (error) return { ok: false, error: error.message };
  await admin.from("profiles").update({ must_change_password: true }).eq("id", profileId);
  return { ok: true, name: p.full_name, mobile: p.mobile, password };
}

export async function removeLogin(profileId: string): Promise<Result> {
  const me = await requireOwner();
  if (!me) return { ok: false, error: "Only an owner can do this." };
  if (me.id === profileId) return { ok: false, error: "You can't remove your own login." };
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("full_name, mobile, role").eq("id", profileId).single();
  if (!p) return { ok: false, error: "Login not found." };
  if (p.role === "rider") return { ok: false, error: "Rider logins are closed when the scooter is returned." };
  const { error } = await admin.auth.admin.deleteUser(profileId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, name: p.full_name, mobile: p.mobile };
}

export async function saveRiderMobile(riderId: string, mobileRaw: string): Promise<Result> {
  if (!(await requireOwner())) return { ok: false, error: "Only an owner can do this." };
  const mobile = clean(mobileRaw);
  if (mobile.length !== 10) return { ok: false, error: "Enter a 10-digit mobile number." };
  const admin = createAdminClient();
  const { data: r } = await admin.from("riders").select("full_name, profile_id").eq("id", riderId).single();
  if (!r) return { ok: false, error: "Rider not found." };
  if (r.profile_id) return { ok: false, error: "This rider already has a login. Reset the password instead." };
  const { error } = await admin.from("riders").update({ mobile }).eq("id", riderId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, name: r.full_name, mobile };
}

export async function createRiderLogin(riderId: string): Promise<Result> {
  if (!(await requireOwner())) return { ok: false, error: "Only an owner can do this." };
  const admin = createAdminClient();
  const { data: r } = await admin.from("riders").select("full_name, mobile, profile_id").eq("id", riderId).single();
  if (!r) return { ok: false, error: "Rider not found." };
  if (r.profile_id) return { ok: false, error: "This rider already has a login." };
  const mobile = clean(r.mobile ?? "");
  if (mobile.length !== 10) return { ok: false, error: "Save a 10-digit mobile number for this rider first." };

  const { data: existing } = await admin.from("profiles").select("id, role").eq("mobile", mobile).maybeSingle();
  if (existing) {
    if (existing.role !== "rider") return { ok: false, error: "This number belongs to a staff or owner login." };
    await admin.from("riders").update({ profile_id: existing.id }).eq("id", riderId);
    return { ok: true, name: r.full_name, mobile, note: "This rider already had a login for another scooter, so the same login now covers both." };
  }

  const password = tempPassword();
  const { data, error } = await admin.auth.admin.createUser({ email: emailFor(mobile), password, email_confirm: true });
  if (error || !data.user) return { ok: false, error: error?.message ?? "Couldn't create the login." };
  const { error: pe } = await admin.from("profiles").insert({
    id: data.user.id, full_name: r.full_name, mobile, role: "rider", must_change_password: true,
  });
  if (pe) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: pe.message };
  }
  await admin.from("riders").update({ profile_id: data.user.id }).eq("mobile", mobile).eq("status", "active");
  return { ok: true, name: r.full_name, mobile, password };
}
