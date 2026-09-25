"use server";

import { getMe } from "@/lib/me";
import { DOC_GROUPS } from "@/lib/docs";

export type BundleData = {
  name: string; mobile: string | null; code: string; chassis: string | null; start: string | null;
  rent: number; deposit: number; agreement: { body: string; signed_at: string; version: number; mobile: string | null } | null;
  docs: { group: string; label: string; url: string }[];
};

export async function getBundle(riderId: string): Promise<{ ok: boolean; error: string; data?: BundleData }> {
  const me = await getMe();
  if (!me || !["owner", "staff"].includes(me.role)) return { ok: false, error: "Only owner or staff can download." };
  const s = me.supabase;
  const [{ data: r }, { data: docs }, { data: sig }] = await Promise.all([
    s.from("riders").select("full_name, mobile, start_date, weekly_rent, security_deposit, scooters(code, chassis_no)").eq("id", riderId).single(),
    s.from("documents").select("kind, path").eq("rider_id", riderId).eq("status", "verified"),
    s.from("rider_agreements").select("body, signed_at, version, mobile").eq("rider_id", riderId).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!r) return { ok: false, error: "Rider not found." };
  const rows = (docs ?? []) as { kind: string; path: string }[];
  const { data: signed } = rows.length
    ? await s.storage.from("rider-docs").createSignedUrls(rows.map((d) => d.path), 600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const url = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
  const list: BundleData["docs"] = [];
  for (const g of DOC_GROUPS) for (const [k, label] of g.items) {
    const d = rows.find((x) => x.kind === k);
    if (d && url.get(d.path)) list.push({ group: g.title, label, url: url.get(d.path)! });
  }
  const sc = (r as unknown as { scooters: { code: string; chassis_no: string | null } | null }).scooters;
  return {
    ok: true, error: "",
    data: {
      name: r.full_name, mobile: r.mobile, code: sc?.code ?? "–", chassis: sc?.chassis_no ?? null, start: r.start_date,
      rent: Number(r.weekly_rent), deposit: Number(r.security_deposit), agreement: sig ?? null, docs: list,
    },
  };
}
