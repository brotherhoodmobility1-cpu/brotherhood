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
      return setError("Couldn't save the password. Try a different one.");
    }
    await supabase.rpc("mark_password_changed");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 flex justify-center p-6">
      <form onSubmit={handleSave} className="w-full max-w-sm bg-white rounded-2xl border p-6 mt-10 space-y-4">
        <h1 className="text-xl font-bold">Set your own password</h1>
        <p className="text-sm text-neutral-600">You logged in with a temporary password. Choose a new one that only you know.</p>
        <input type="password" autoComplete="new-password" placeholder="New password (6+ characters)"
          value={p1} onChange={(e) => setP1(e.target.value)} className="w-full border rounded-lg px-3 py-2.5" />
        <input type="password" autoComplete="new-password" placeholder="Repeat new password"
          value={p2} onChange={(e) => setP2(e.target.value)} className="w-full border rounded-lg px-3 py-2.5" />
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-green-700 text-white font-semibold rounded-lg py-2.5 disabled:opacity-60">
          {loading ? "Saving…" : "Save password and continue"}
        </button>
      </form>
    </main>
  );
}