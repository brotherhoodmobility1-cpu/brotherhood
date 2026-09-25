"use server";

import { getMe } from "@/lib/me";

export async function saveAgreementVersion(body: string) {
  const me = await getMe();
  if (me?.role !== "owner") return { ok: false, error: "Only an owner can change the agreement." };
  if (body.trim().length < 50) return { ok: false, error: "The agreement text looks too short." };
  const { error } = await me.supabase.from("agreement_templates").insert({ body: body.trim(), created_by: me.id });
  return error ? { ok: false, error: error.message } : { ok: true, error: "" };
}
