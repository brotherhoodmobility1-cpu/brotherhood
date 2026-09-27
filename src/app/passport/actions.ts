"use server";

import { getMe } from "@/lib/me";

type Res = { ok: boolean; error: string; code?: string };
export type ScooterFields = { chassis_no: string; motor_no: string; model: string; reg_no: string; purchase_date: string };

const team = async () => {
  const me = await getMe();
  return me && ["owner", "staff"].includes(me.role) ? me : null;
};

export async function addScooter(v: ScooterFields): Promise<Res> {
  const me = await team();
  if (!me) return { ok: false, error: "Only owner or staff can add scooters." };
  if (!v.chassis_no.trim()) return { ok: false, error: "Enter the chassis number." };
  const { data: all } = await me.supabase.from("scooters").select("code");
  const next = Math.max(0, ...((all ?? []) as { code: string }[]).map((s) => Number(s.code.replace(/\D/g, "")) || 0)) + 1;
  const code = `MOTO-${next}`;
  const { error } = await me.supabase.from("scooters").insert({
    code, chassis_no: v.chassis_no.trim(), motor_no: v.motor_no.trim() || null, model: v.model.trim() || null,
    reg_no: v.reg_no.trim() || null, purchase_date: v.purchase_date || null, status: "available",
  });
  return error ? { ok: false, error: error.message } : { ok: true, error: "", code };
}

export async function updateScooter(id: number, v: ScooterFields): Promise<Res> {
  const me = await team();
  if (!me) return { ok: false, error: "Only owner or staff can edit scooters." };
  const { error } = await me.supabase.from("scooters").update({
    chassis_no: v.chassis_no.trim() || null, motor_no: v.motor_no.trim() || null, model: v.model.trim() || null,
    reg_no: v.reg_no.trim() || null, purchase_date: v.purchase_date || null,
  }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true, error: "" };
}

export async function retireScooter(id: number): Promise<Res> {
  const me = await getMe();
  if (me?.role !== "owner") return { ok: false, error: "Only an owner can retire a scooter." };
  const { data: s } = await me.supabase.from("scooters").select("status").eq("id", id).single();
  if (s?.status !== "available") return { ok: false, error: "Only an available scooter (no rider, not with the mechanic) can be retired." };
  const { error } = await me.supabase.from("scooters").update({ status: "retired" }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true, error: "" };
}
