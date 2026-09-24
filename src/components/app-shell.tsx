"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Icon from "./icons";
import { createClient } from "@/lib/supabase/client";

const TABS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/fleet", label: "Fleet" },
  { href: "/riders", label: "Riders" },
  { href: "/scooters", label: "Scooters" },
  { href: "/enquiries", label: "Enquiries" },
];

export default function AppShell({ name, role, children }: { name: string; role: string; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
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
        {TABS.map((t) => (
          <button key={t.href} className={path.startsWith(t.href) ? "on" : ""} onClick={() => router.push(t.href)}>
            <Icon name={t.label} />
            <span>{t.label}</span>
          </button>
        ))}
        <button onClick={logout}>
          <Icon name="Log out" />
          <span>Log out</span>
        </button>
      </nav>
      <main key={path} className="anim">{children}</main>
    </div>
  );
}
