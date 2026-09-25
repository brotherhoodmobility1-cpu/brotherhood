import { createClient } from "@supabase/supabase-js";

/** Server-only client with full access. Never import this in a "use client" file. */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
