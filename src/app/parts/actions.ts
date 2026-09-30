"use server";

import { getMe } from "@/lib/me";

type Res = { ok: boolean; error: string };
const team = async () => { const me = await getMe(); return me && ["owner", "staff"].includes(me.role) ? me : null; };

export async function addStockItem(name: string, barcode: string, qty: number, price: number, min: number): Promise<Res> {
  const me = await team();
  if (!me) return { ok: false, error: "Only owner or staff can add spare parts." };
  const { error } = await me.supabase.rpc("add_stock_item", { p_name: name, p_barcode: barcode, p_qty: Math.round(qty), p_price: price, p_min: Math.round(min) });
  return error ? { ok: false, error: error.message } : { ok: true, error: "" };
}

export async function stockIn(id: number, qty: number, price: number | null, note: string): Promise<Res> {
  const me = await team();
  if (!me) return { ok: false, error: "Only owner or staff can add stock." };
  const { error } = await me.supabase.rpc("stock_in", { p_part: id, p_qty: Math.round(qty), p_price: price, p_note: note });
  return error ? { ok: false, error: error.message } : { ok: true, error: "" };
}

export async function editStockItem(id: number, v: { name: string; barcode: string; unit_price: number; min_stock: number }): Promise<Res> {
  const me = await team();
  if (!me) return { ok: false, error: "Only owner or staff can edit spare parts." };
  if (!v.name.trim() || v.unit_price < 0 || v.min_stock < 0) return { ok: false, error: "Check the name, price and minimum stock." };
  const { error } = await me.supabase.from("parts_inventory").update({
    name: v.name.trim(), barcode: v.barcode.trim() || null, unit_price: v.unit_price, min_stock: Math.round(v.min_stock), updated_at: new Date().toISOString(),
  }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true, error: "" };
}

export async function correctStock(id: number, qty: number, note: string): Promise<Res> {
  const me = await getMe();
  if (me?.role !== "owner") return { ok: false, error: "Only an owner can correct stock counts." };
  const { error } = await me.supabase.rpc("adjust_stock", { p_part: id, p_new_qty: Math.round(qty), p_note: note });
  return error ? { ok: false, error: error.message } : { ok: true, error: "" };
}

export async function archiveStockItem(id: number): Promise<Res> {
  const me = await getMe();
  if (me?.role !== "owner") return { ok: false, error: "Only an owner can remove a part from the list." };
  const { error } = await me.supabase.from("parts_inventory").update({ active: false, updated_at: new Date().toISOString() }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true, error: "" };
}
