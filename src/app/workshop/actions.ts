"use server";

import { getMe } from "@/lib/me";

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
