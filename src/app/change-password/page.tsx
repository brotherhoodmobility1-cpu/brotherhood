"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (p1.length < 6) return setError("Use at least 6 characters.");
    if (p1 !== p2) return setError("The two passwords don't match.");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: p1 });
    if (error) {
      setLoading(false);
      return setError("Choose a different password from the temporary one.");
    }
    await supabase.rpc("mark_password_changed");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <header>
        <div className="in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/brand/logo-mark.jpg" alt="" />
          <div><h1>Brotherhood Mobility</h1><p>Set your own password.</p></div>
        </div>
      </header>
      <main>
        <form className="phone" onSubmit={handleSave}>
          <h2>Set your own password</h2>
          <p className="mute">You logged in with a temporary password. Choose a new one that only you know.</p>
          <label htmlFor="np1">New password</label>
          <input id="np1" type="password" autoComplete="new-password" placeholder="At least 6 characters" value={p1} onChange={(e) => setP1(e.target.value)} />
          <label htmlFor="np2">Repeat new password</label>
          <input id="np2" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
          {error && <p className="lerr" role="alert">{error}</p>}
          <button type="submit" className="a p" style={{ width: "100%", padding: 11 }} disabled={loading}>
            {loading ? "Saving…" : "Save password and continue"}
          </button>
        </form>
      </main>
    </>
  );
}
