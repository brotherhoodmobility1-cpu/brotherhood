"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const digits = mobile.replace(/\D/g, "").slice(-10);
    if (digits.length !== 10 || !password) {
      setError("Enter your 10-digit mobile number and password.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: `${digits}@users.brotherhoodmobility.in`,
      password,
    });
    if (error || !data.user) {
      setLoading(false);
      setError("Wrong mobile number or password. Ask the owner to reset it if you forgot.");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", data.user.id)
      .single();
    router.push(profile?.must_change_password ? "/change-password" : "/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="bg-black text-white px-6 py-5 border-b-4 border-yellow-400">
        <h1 className="text-2xl font-extrabold italic tracking-wide">BROTHERHOOD MOBILITY</h1>
        <p className="text-sm text-neutral-400">Log in with your mobile number and password</p>
      </header>
      <div className="flex justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-white rounded-2xl border p-6 mt-6 space-y-4">
          <h2 className="text-xl font-bold">Log in</h2>
          <div>
            <label htmlFor="mobile" className="block text-sm text-neutral-600 mb-1">Mobile number</label>
            <input
              id="mobile" type="tel" inputMode="numeric" autoComplete="username"
              value={mobile} onChange={(e) => setMobile(e.target.value)}
              placeholder="10-digit mobile number"
              className="w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm text-neutral-600 mb-1">Password</label>
            <div className="flex gap-2">
              <input
                id="password" type={show ? "text" : "password"} autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="flex-1 border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              <button type="button" onClick={() => setShow(!show)} className="border rounded-lg px-3 text-sm font-semibold">
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg py-2.5 disabled:opacity-60">
            {loading ? "Logging in…" : "Log in"}
          </button>
          <p className="text-sm text-neutral-500">Forgot your password? Ask the owner to reset it.</p>
        </form>
      </div>
    </main>
  );
}