import AppShell from "@/components/app-shell";
import Empty from "@/components/empty";
import MarkContacted from "@/components/mark-contacted";
import Link from "next/link";
import { requireTeam } from "@/lib/auth";

type Enquiry = { id: number; name: string; mobile: string; area: string | null; need: string | null; note: string | null; status: string; created_at: string };

function dmy(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Asia/Kolkata" });
}

export default async function EnquiriesPage() {
  const { supabase, profile } = await requireTeam();
  const { data } = await supabase
    .from("enquiries")
    .select("id, name, mobile, area, need, note, status, created_at")
    .order("created_at", { ascending: false });
  const list = (data ?? []) as Enquiry[];

  return (
    <AppShell name={profile.full_name} role={profile.role}>
      <h2>Enquiries ({list.length})</h2>
      {list.length === 0 ? (
        <Empty text="No enquiries yet. People who tap Join Brotherhood Mobility on the login screen appear here." />
      ) : (
        list.map((l) => (
          <div className="row" key={l.id}>
            <div className="m">
              <b>{l.name}</b>
              <small>
                {l.area || "City not given"} · {l.need} · {dmy(l.created_at)}
                {l.note ? <><br />{l.note}</> : null}
              </small>
            </div>
            <a className="tag" href={`tel:${l.mobile}`}>Call {l.mobile}</a>
            <span className={`tag ${l.status === "new" ? "due" : ""}`}>{l.status === "new" ? "New" : l.status === "approved" ? "Approved" : "Contacted"}</span>
            {l.status === "new" && <MarkContacted id={l.id} />}
            {profile.role === "owner" && l.status !== "approved" && (
              <Link className="a" style={{ textDecoration: "none", padding: "7px 13px", border: "1.5px solid var(--line)", borderRadius: 10, fontWeight: 600, fontSize: 14 }}
                href={`/riders?enquiry=${l.id}&name=${encodeURIComponent(l.name)}&mobile=${l.mobile}`}>Approve as rider</Link>
            )}
          </div>
        ))
      )}
    </AppShell>
  );
}
