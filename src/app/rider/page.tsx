import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import RiderApp, { type RiderData, type RiderDoc, type Signature, type Payment, type Claim } from "@/components/rider-app";
import { createClient } from "@/lib/supabase/server";

export default async function RiderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("full_name, mobile, role, must_change_password").eq("id", user.id).single();
  if (!profile) redirect("/login");
  if (profile.must_change_password) redirect("/change-password");
  if (profile.role !== "rider") redirect("/");

  const { data: rows } = await supabase
    .from("riders")
    .select("id, full_name, start_date, weekly_rent, security_deposit, wallet_balance, late_days, action_needed, scooters(code, chassis_no)")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .order("scooter_id");
  const riders = (rows ?? []) as unknown as RiderData[];

  if (riders.length === 0) {
    return (
      <AppShell name={profile.full_name} role="rider">
        <div className="phone">
          <h2>Welcome, {profile.full_name.split(" ")[0]}</h2>
          <p>You are approved to rent with Brotherhood Mobility. Our team will allot you a scooter soon.</p>
        </div>
      </AppShell>
    );
  }

  const ids = riders.map((r) => r.id);
  const { data: docRows } = await supabase.from("documents").select("rider_id, kind, status, path").in("rider_id", ids);
  const docs = (docRows ?? []) as (RiderDoc & { rider_id: string })[];
  const paths = docs.filter((d) => d.path).map((d) => d.path!);
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("rider-docs").createSignedUrls(paths, 3600);
    (signed ?? []).forEach((s) => { if (s.path && s.signedUrl) urls[s.path] = s.signedUrl; });
  }

  const [{ data: tpl }, { data: sigs }, { data: pays }, { data: claims }, { data: settings }] = await Promise.all([
    supabase.from("agreement_templates").select("version, body").order("version", { ascending: false }).limit(1).single(),
    supabase.from("rider_agreements").select("rider_id, version, body, signed_at, mobile").in("rider_id", ids).order("version", { ascending: false }),
    supabase.from("payments").select("id, rider_id, amount, method, receipt_no, razorpay_payment_id, utr, paid_at")
      .in("rider_id", ids).eq("status", "paid").order("paid_at", { ascending: false }),
    supabase.from("payment_claims").select("id, rider_id, amount, utr, status, reject_reason, created_at")
      .in("rider_id", ids).order("created_at", { ascending: false }).limit(20),
    supabase.from("app_settings").select("key, value").in("key", ["upi_id", "qr_version"]),
  ]);
  const set = Object.fromEntries(((settings ?? []) as { key: string; value: string }[]).map((s) => [s.key, s.value]));
  const qrUrl = set.qr_version ? `${supabase.storage.from("brand").getPublicUrl("payment-qr.jpg").data.publicUrl}?v=${set.qr_version}` : null;

  return (
    <AppShell name={profile.full_name} role="rider">
      <RiderApp
        mobile={profile.mobile}
        template={tpl ?? null}
        signatures={(sigs ?? []) as Signature[]}
        payments={(pays ?? []) as Payment[]}
        claims={(claims ?? []) as Claim[]}
        qrUrl={qrUrl}
        upiId={set.upi_id ?? ""}
        riders={riders}
        docs={docs.map((d) => ({ ...d, url: d.path ? urls[d.path] ?? "" : "" }))}
      />
    </AppShell>
  );
}
