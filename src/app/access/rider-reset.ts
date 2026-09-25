"use server";

import { createClient } from "@/lib/supabase/server";
import { resetPassword } from "./actions";

export async function resetRiderPassword(riderId: string) {
  const supabase = await createClient();
  const { data: r } = await supabase.from("riders").select("profile_id").eq("id", riderId).single();
  if (!r?.profile_id) return { ok: false as const, error: "This rider has no login yet." };
  return resetPassword(r.profile_id);
}
