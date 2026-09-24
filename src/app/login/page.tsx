"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import JoinModal from "@/components/join-modal";
import WelcomeZoom from "@/components/welcome-zoom";

export default function LoginPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [join, setJoin] = useState(false);
  const [zoom, setZoom] = useState("");

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
      setError("Wrong mobile number or password. Check it and try again, or ask the owner to reset it.");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, must_change_password")
      .eq("id", data.user.id)
      .single();
    const dest = profile?.must_change_password ? "/change-password" : "/dashboard";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      router.push(dest);
      return;
    }
    const first = (profile?.full_name ?? "").split(" ")[0];
    setZoom(profile?.role === "rider" && first ? `Welcome, ${first}` : "Welcome back");
    setTimeout(() => {
      router.push(dest);
      router.refresh();
    }, 1650);
  }

  return (
    <>
      <header>
        <div className="in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/brand/logo-mark.jpg" alt="" />
          <div>
            <h1>Brotherhood Mobility</h1>
            <p>Log in with your mobile number and password.</p>
          </div>
        </div>
      </header>
      <main>
        <div className="hero intro">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hlogo" src="/brand/logo-full.jpg" alt="Brotherhood. Ride. Earn. Grow." />
        </div>
        <form className="phone" onSubmit={handleLogin}>
          <h2>Log in</h2>
          <label htmlFor="lp">Mobile number</label>
          <input id="lp" type="tel" inputMode="numeric" autoComplete="username" placeholder="10-digit mobile number"
            value={mobile} onChange={(e) => setMobile(e.target.value)} />
          <label htmlFor="lpw">Password</label>
          <div className="pwf">
            <input id="lpw" type={show ? "text" : "password"} autoComplete="current-password" placeholder="Your password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="a" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
          </div>
          {error && <p className="lerr" role="alert">{error}</p>}
          <button type="submit" className="a p" style={{ width: "100%", padding: 11 }} disabled={loading}>
            {loading ? "Logging in…" : "Log in"}
          </button>
          <p className="mute" style={{ margin: "10px 0 0", fontSize: 13.5 }}>Forgot your password? Ask the owner to reset it.</p>
          <button type="button" className="a p" style={{ width: "100%", marginTop: 12 }} onClick={() => setJoin(true)}>
            Want to rent a scooter? Join Brotherhood Mobility
          </button>
        </form>
      </main>
      <JoinModal open={join} onClose={() => setJoin(false)} />
      {zoom && <WelcomeZoom title={zoom} />}
    </>
  );
}
