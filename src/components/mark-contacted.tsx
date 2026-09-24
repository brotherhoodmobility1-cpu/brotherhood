"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MarkContacted({ id }: { id: number }) {
  const router = useRouter();
  async function mark() {
    await createClient().from("enquiries").update({ status: "contacted" }).eq("id", id);
    router.refresh();
  }
  return <button className="a p" onClick={mark}>Mark contacted</button>;
}
