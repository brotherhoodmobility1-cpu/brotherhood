import AppShell from "@/components/app-shell";
import PaymentsAdmin, { type PayRow, type RiderPick, type ClaimRow } from "@/components/payments-admin";
import { requireTeam } from "@/lib/auth";

export default async function PaymentsPage() {
  const { supabase, profile } = await requireTeam();
  const [{ data: pays }, { data: riders }, { data: claims }, { data: settings }] = await Promise.all([
    supabase.from("payments")
      .select("id, amount, method, receipt_no, razorpay_payment_id, utr, paid_at, riders(full_name, scooters(code))")
      .eq("status", "paid").order("paid_at", { ascending: false }).limit(500),
    supabase.from("riders").select("id, full_name, wallet_balance, scooters(code)").eq("status", "active").order("scooter_id"),
    supabase.from("payment_claims")
      .select("id, amount, utr, proof_path, created_at, riders(full_name, wallet_balance, scooters(code))")
      .eq("status", "pending").order("created_at"),
    supabase.from("app_settings").select("key, value").in("key", ["upi_id", "qr_version"]),
  ]);
  const pending = (claims ?? []) as unknown as (ClaimRow & { proof_path: string })[];
  const urls: Record<string, string> = {};
  if (pending.length) {
    const { data: signed } = await supabase.storage.from("payment-proofs").createSignedUrls(pending.map((c) => c.proof_path), 3600);
    (signed ?? []).forEach((s) => { if (s.path && s.signedUrl) urls[s.path] = s.signedUrl; });
  }
  const set = Object.fromEntries(((settings ?? []) as { key: string; value: string }[]).map((s) => [s.key, s.value]));
  const qrUrl = set.qr_version ? `${supabase.storage.from("brand").getPublicUrl("payment-qr.jpg").data.publicUrl}?v=${set.qr_version}` : null;

  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <PaymentsAdmin
        owner={profile.role === "owner"}
        pays={(pays ?? []) as unknown as PayRow[]}
        riders={(riders ?? []) as unknown as RiderPick[]}
        claims={pending.map((c) => ({ ...c, proofUrl: urls[c.proof_path] ?? "" }))}
        upiId={set.upi_id ?? ""}
        qrUrl={qrUrl}
      />
    </AppShell>
  );
}
