"use server";

import { createClient } from "@/lib/supabase/server";

async function teamUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return me && ["owner", "staff"].includes(me.role) ? { supabase, id: user.id } : null;
}

export async function verifyDocuments(ids: number[]) {
  const t = await teamUser();
  if (!t) return { ok: false, error: "Only owner or staff can verify." };
  const { error } = await t.supabase.from("documents")
    .update({ status: "verified", verified_by: t.id, verified_at: new Date().toISOString() })
    .in("id", ids).eq("status", "uploaded");
  return error ? { ok: false, error: error.message } : { ok: true, error: "" };
}

export async function rejectDocument(id: number) {
  const t = await teamUser();
  if (!t) return { ok: false, error: "Only owner or staff can reject." };
  const { error } = await t.supabase.from("documents").update({ status: "rejected" }).eq("id", id).eq("status", "uploaded");
  return error ? { ok: false, error: error.message } : { ok: true, error: "" };
}
