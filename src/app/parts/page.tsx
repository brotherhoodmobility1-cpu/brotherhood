import AppShell from "@/components/app-shell";
import PartsManager from "@/components/parts-manager";
import { requireTeam } from "@/lib/auth";
import type { StockItem } from "@/lib/parts";

export default async function PartsPage() {
  const { supabase, profile } = await requireTeam();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: items }, { data: used }] = await Promise.all([
    supabase.from("parts_inventory").select("id, name, barcode, unit_price, quantity, min_stock").eq("active", true).order("name"),
    supabase.from("stock_movements").select("part_id, change").eq("kind", "used").gte("created_at", since),
  ]);
  const used30 = new Map<number, number>();
  ((used ?? []) as { part_id: number; change: number }[]).forEach((u) => used30.set(u.part_id, (used30.get(u.part_id) ?? 0) - u.change));
  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <PartsManager owner={profile.role === "owner"} items={(items ?? []) as StockItem[]} used30={Object.fromEntries(used30)} />
    </AppShell>
  );
}
