"use server";

import { getMe } from "@/lib/me";
import { handoverProblem, type HandoverInput } from "@/lib/handover";
import { saveHandover } from "@/lib/handover-server";
import { pushToRider } from "@/lib/push";

type Res = { ok: boolean; error: string };

export async function clearJob(id: number): Promise<Res> {
  const me = await getMe();
  if (!me || !["owner", "staff", "mechanic"].includes(me.role)) return { ok: false, error: "Not allowed." };
  const { error } = await me.supabase.rpc("clear_job", { p_job: id });
  return error ? { ok: false, error: error.message } : { ok: true, error: "" };
}

export async function setHold(riderId: string, hold: boolean): Promise<Res> {
  const me = await getMe();
  if (me?.role !== "owner") return { ok: false, error: "Only an owner can hold rent." };
  const { error } = await me.supabase.rpc("set_hold", { p_rider: riderId, p_hold: hold });
  return error ? { ok: false, error: error.message } : { ok: true, error: "" };
}

export async function chargeJob(id: number): Promise<Res & { amount?: number }> {
  const me = await getMe();
  if (me?.role !== "owner") return { ok: false, error: "Only an owner can charge a rider." };
  const { data, error } = await me.supabase.rpc("charge_job", { p_job: id });
  return error ? { ok: false, error: error.message } : { ok: true, error: "", amount: Number(data) };
}

export async function clearJobWithHandover(id: number, handover: HandoverInput): Promise<Res> {
  const me = await getMe();
  if (!me || !["owner", "staff", "mechanic"].includes(me.role)) return { ok: false, error: "Not allowed." };
  const hp = handoverProblem(handover);
  if (hp) return { ok: false, error: hp };
  const { data: job } = await me.supabase.from("jobs").select("scooter_id").eq("id", id).single();
  if (!job) return { ok: false, error: "Job not found." };
  const { data: rider } = await me.supabase.from("riders").select("id").eq("scooter_id", job.scooter_id).eq("status", "active").maybeSingle();
  const { error } = await me.supabase.rpc("clear_job", { p_job: id });
  if (error) return { ok: false, error: error.message };
  const he = await saveHandover(me.supabase, me.id, { scooterId: job.scooter_id, riderId: rider?.id ?? null, kind: "repair", h: handover });
  if (rider?.id) await pushToRider(rider.id, "repaired", {
    title: "Your scooter is repaired",
    body: "It's ready to ride. Please check the handover photos in the app and confirm. / स्कूटर तैयार है, कृपया फ़ोटो देखकर पुष्टि करें।",
    url: "/rider", tag: "handover",
  });
  return he ? { ok: true, error: `Cleared to ride, but the handover photos couldn't be saved: ${he}` } : { ok: true, error: "" };
}
