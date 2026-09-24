"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button onClick={logout} className="border border-neutral-600 rounded-lg px-3 py-1.5 text-sm">
      Log out
    </button>
  );
}