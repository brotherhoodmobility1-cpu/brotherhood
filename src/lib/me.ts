import { createClient } from "@/lib/supabase/server";

/** Who is calling a server action: returns null if not logged in. */
export async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!p) return null;
  return { supabase, id: user.id, role: p.role as string, name: p.full_name as string };
}
