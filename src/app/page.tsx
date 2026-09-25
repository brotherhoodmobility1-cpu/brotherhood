import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role, must_change_password").eq("id", user.id).single();
  if (!profile) redirect("/login");
  if (profile.must_change_password) redirect("/change-password");
  redirect(profile.role === "rider" ? "/rider" : "/dashboard");
}
