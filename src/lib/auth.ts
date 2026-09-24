import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireTeam(roles: string[] = ["owner", "staff"]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, must_change_password")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.must_change_password) redirect("/change-password");
  if (!roles.includes(profile.role)) redirect("/login");

  return { supabase, profile };
}