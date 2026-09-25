"use server";

import { getMe } from "@/lib/me";

export async function saveHub(lat: number, lng: number) {
  const me = await getMe();
  if (me?.role !== "owner") return { ok: false, error: "Only an owner can set the hub." };
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, error: "Enter latitude and longitude like 28.45950, 77.02660" };
  const { error } = await me.supabase.from("app_settings").upsert(
    [{ key: "hub_lat", value: String(lat) }, { key: "hub_lng", value: String(lng) }], { onConflict: "key" });
  return error ? { ok: false, error: error.message } : { ok: true, error: "" };
}
