"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Icon from "./icons";
import { createClient } from "@/lib/supabase/client";

const TEAM = ["owner", "staff"];
const TABS = [
  { href: "/dashboard", label: "Dashboard", roles: TEAM },
  { href: "/today", label: "Today's payments", roles: TEAM },
  { href: "/fleet", label: "Fleet", roles: TEAM },
  { href: "/live-map", label: "Live map", roles: TEAM },
  { href: "/analytics", label: "Analytics", roles: ["owner"] },
  { href: "/riders", label: "Riders", roles: TEAM },
  { href: "/scooters", label: "Scooters", roles: TEAM },
  { href: "/passport", label: "Scooter Passport", roles: TEAM },
  { href: "/workshop", label: "Workshop", roles: ["owner", "staff", "mechanic"] },
  { href: "/maintenance", label: "Maintenance", roles: TEAM },
  { href: "/parts", label: "Spare Parts", roles: TEAM },
  { href: "/documents", label: "Documents", roles: TEAM },
  { href: "/payments", label: "Payments", roles: TEAM },
  { href: "/enquiries", label: "Enquiries", roles: TEAM },
  { href: "/agreement", label: "Agreement", roles: TEAM },
  { href: "/messages", label: "Messages", roles: ["owner"] },
  { href: "/access", label: "Access", roles: ["owner"] },
];

export default function AppShell({ name, role, children }: { name: string; role: string; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState(path);
  const tabs = TABS.filter((t) => t.roles.includes(role));
  useEffect(() => { setTarget(path); }, [path]);
  // Load every tab in the background, so switching feels instant.
  useEffect(() => { tabs.forEach((t) => router.prefetch(t.href)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [role]);
  const go = (href: string) => {
    if (href === path) return;
    setTarget(href);
    startTransition(() => router.push(href));
  };
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="shell">
      <header>
        <div className="in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/brand/logo-mark.jpg" alt="" />
          <div>
            <h1>Brotherhood Mobility</h1>
            <p>Signed in as {name} ({roleLabel}){role === "owner" ? ". You can edit records." : ""}</p>
          </div>
        </div>
      </header>
      <nav>
        {tabs.map((t) => (
          <button key={t.href} className={target.startsWith(t.href) ? "on" : ""} onClick={() => go(t.href)}>
            <Icon name={t.label} />
            <span>{t.label}</span>
          </button>
        ))}
        <button onClick={logout}>
          <Icon name="Log out" />
          <span>Log out</span>
        </button>
      </nav>
      {pending && (
        <>
          <style>{`@keyframes bmload{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}`}</style>
          <div aria-hidden="true" style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 50, overflow: "hidden", background: "rgba(242,183,5,.25)" }}>
            <div style={{ width: "40%", height: "100%", background: "#f2b705", animation: "bmload 0.9s ease-in-out infinite" }} />
          </div>
        </>
      )}
      <main key={path} className="anim" style={{ opacity: pending ? 0.55 : 1, transition: "opacity .15s" }} aria-busy={pending}>{children}</main>
    </div>
  );
}
