import Link from "next/link";
import LogoutButton from "@/app/dashboard/logout-button";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/riders", label: "Riders" },
  { href: "/scooters", label: "Scooters" },
];

export default function AdminHeader({ name, role, active }: { name: string; role: string; active: string }) {
  return (
    <header className="bg-black text-white border-b-4 border-yellow-400">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold italic tracking-wide">BROTHERHOOD MOBILITY</h1>
          <p className="text-sm text-neutral-400">Signed in as {name} ({role})</p>
        </div>
        <LogoutButton />
      </div>
      <nav className="px-4 flex gap-1 overflow-x-auto">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-2 text-sm font-semibold border-b-2 whitespace-nowrap ${
              active === l.href ? "border-green-500 text-white" : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}