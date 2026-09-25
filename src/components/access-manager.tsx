"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import Plate from "./plate";
import { createTeamLogin, createRiderLogin, removeLogin, resetPassword, saveRiderMobile } from "@/app/access/actions";
import { resetRiderPassword } from "@/app/access/rider-reset";

export type TeamLogin = { id: string; full_name: string; mobile: string; role: string; must_change_password: boolean };
export type RiderLogin = { id: string; name: string; mobile: string | null; code: string; login: "none" | "temp" | "set" };

type Cred = { name: string; mobile: string; password?: string; note?: string };
type Ask = { title: string; body: string; yes: string; danger?: boolean; run: () => Promise<void> };

function StatusTag({ s }: { s: "none" | "temp" | "set" }) {
  if (s === "set") return <span className="tag">Password set</span>;
  if (s === "temp") return <span className="tag due">Temporary password</span>;
  return <span className="tag bad">No login yet</span>;
}

export default function AccessManager({ me, team, riders }: { me: string; team: TeamLogin[]; riders: RiderLogin[] }) {
  const router = useRouter();
  const [ask, setAsk] = useState<Ask | null>(null);
  const [cred, setCred] = useState<Cred | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nName, setNName] = useState("");
  const [nMobile, setNMobile] = useState("");
  const [nRole, setNRole] = useState("staff");
  const [mobiles, setMobiles] = useState<Record<string, string>>({});
  const owners = team.filter((t) => t.role === "owner").length;

  async function confirm() {
    if (!ask) return;
    setBusy(true);
    await ask.run();
    setBusy(false);
  }

  function handle(res: Awaited<ReturnType<typeof resetPassword>>, showCred = true) {
    setAsk(null);
    if (!res.ok) return setErr(res.error);
    setErr("");
    if (showCred && (res.password || res.note)) {
      setCopied(false);
      setCred({ name: res.name, mobile: res.mobile, password: res.password, note: res.note });
    }
    router.refresh();
  }

  function waLink(c: Cred) {
    const msg = `Brotherhood Mobility login\nMobile: ${c.mobile}\nPassword: ${c.password}\nYou will set your own password when you first log in.\nOpen: https://app.brotherhoodmobility.in`;
    return `https://wa.me/91${c.mobile}?text=${encodeURIComponent(msg)}`;
  }

  return (
    <>
      {err && <p className="lerr" role="alert">{err}</p>}

      <h2>Owner, staff and mechanic logins</h2>
      {team.map((t) => (
        <div className="row" key={t.id}>
          <div className="m">
            <b>{t.full_name}</b>
            <small>{t.mobile} · {t.role === "owner" ? "Owner" : t.role === "mechanic" ? "Mechanic" : "Staff"}</small>
          </div>
          <StatusTag s={t.must_change_password ? "temp" : "set"} />
          {t.id !== me && (
            <button className="a" onClick={() => setAsk({
              title: `Reset password for ${t.full_name}?`,
              body: "Their old password stops working straight away. A new temporary password is shown once, and they choose their own at first login.",
              yes: "Yes, reset password",
              run: async () => handle(await resetPassword(t.id)),
            })}>Reset password</button>
          )}
          {t.id !== me && !(t.role === "owner" && owners < 2) && (
            <button className="a" onClick={() => setAsk({
              title: `Remove access for ${t.full_name}?`,
              body: `${t.mobile} will no longer be able to log in.`,
              yes: "Yes, remove",
              danger: true,
              run: async () => handle(await removeLogin(t.id), false),
            })}>Remove</button>
          )}
        </div>
      ))}

      <div className="row" style={{ display: "block" }}>
        <b>Give new access</b>
        <input style={{ marginTop: 8 }} placeholder="Name" value={nName} onChange={(e) => setNName(e.target.value)} />
        <input type="tel" inputMode="numeric" placeholder="10-digit mobile number" value={nMobile} onChange={(e) => setNMobile(e.target.value)} />
        <select value={nRole} onChange={(e) => setNRole(e.target.value)}>
          <option value="staff">Staff</option>
          <option value="mechanic">Mechanic</option>
          <option value="owner">Owner</option>
        </select>
        <button className="a p" onClick={() => {
          const m = nMobile.replace(/\D/g, "").slice(-10);
          if (!nName.trim() || m.length !== 10) return setErr("Enter a name and a 10-digit mobile number.");
          setErr("");
          setAsk({
            title: "Check before saving",
            body: `Give ${nName.trim()} (${m}) ${nRole === "owner" ? "Owner" : nRole === "mechanic" ? "Mechanic" : "Staff"} access?`,
            yes: "Yes, create login",
            run: async () => {
              const res = await createTeamLogin(nName, m, nRole);
              if (res.ok) { setNName(""); setNMobile(""); }
              handle(res);
            },
          });
        }}>Create login</button>
      </div>

      <h2>Rider logins</h2>
      {riders.map((r) => (
        <div className="row" key={r.id}>
          <div className="m"><b>{r.name} · <Plate code={r.code} /></b></div>
          {r.login === "none" ? (
            <>
              <input type="tel" inputMode="numeric" style={{ width: 140, margin: 0 }} placeholder="Mobile"
                value={mobiles[r.id] ?? r.mobile ?? ""} onChange={(e) => setMobiles({ ...mobiles, [r.id]: e.target.value })} />
              {(mobiles[r.id] ?? r.mobile ?? "") !== (r.mobile ?? "") && (
                <button className="a" onClick={() => setAsk({
                  title: "Check before saving",
                  body: `Set the mobile number for ${r.name} to ${(mobiles[r.id] ?? "").replace(/\D/g, "").slice(-10)}?`,
                  yes: "Yes, save number",
                  run: async () => handle(await saveRiderMobile(r.id, mobiles[r.id] ?? ""), false),
                })}>Save number</button>
              )}
            </>
          ) : (
            <span className="mute">{r.mobile}</span>
          )}
          <StatusTag s={r.login} />
          <button className="a" onClick={() => setAsk(
            r.login === "none"
              ? {
                  title: `Create login for ${r.name}?`,
                  body: "A temporary password is created and shown once. They choose their own at first login.",
                  yes: "Yes, create login",
                  run: async () => handle(await createRiderLogin(r.id)),
                }
              : {
                  title: `Reset password for ${r.name}?`,
                  body: "Their old password stops working straight away. A new temporary password is shown once.",
                  yes: "Yes, reset password",
                  run: async () => {
                    const res = await resetRiderPassword(r.id);
                    handle(res);
                  },
                }
          )}>{r.login === "none" ? "Create login" : "Reset password"}</button>
        </div>
      ))}
      <p className="note">Everyone logs in with their mobile number and password. New logins get a temporary password that they change the first time they log in.</p>

      <Modal open={!!ask} onClose={() => !busy && setAsk(null)}>
        {ask && (
          <>
            <h2>{ask.title}</h2>
            <p className="mute">{ask.body}</p>
            <div className="btns">
              <button className="a" onClick={() => setAsk(null)} disabled={busy}>Go back</button>
              <button className={`a ${ask.danger ? "d" : "p"}`} onClick={confirm} disabled={busy}>{busy ? "Working…" : ask.yes}</button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!cred} onClose={() => setCred(null)}>
        {cred && (
          <>
            <h2>Login details for {cred.name}</h2>
            <div className="pt"><span className="mute">Mobile number</span><b>{cred.mobile}</b></div>
            {cred.password && <div className="pt"><span className="mute">Temporary password</span><b className="tpw">{cred.password}</b></div>}
            <p className="mute">
              {cred.note ? cred.note + " " : ""}
              {cred.password ? `Share these with ${cred.name}. The password is shown only now, and they must choose their own password when they first log in.` : ""}
            </p>
            <div className="btns">
              {cred.password && (
                <>
                  <button className="a" onClick={async () => {
                    try { await navigator.clipboard.writeText(cred.password!); setCopied(true); } catch { setCopied(false); }
                  }}>{copied ? "Copied" : "Copy password"}</button>
                  <a className="a" style={{ textDecoration: "none", padding: "8px 13px", border: "1.5px solid var(--line)", borderRadius: 10 }}
                    href={waLink(cred)} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>
                </>
              )}
              <button className="a p" onClick={() => setCred(null)}>Done</button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

