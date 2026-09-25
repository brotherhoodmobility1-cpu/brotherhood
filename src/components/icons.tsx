const PATHS: Record<string, string> = {
  Dashboard: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/>',
  Fleet: '<circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><path d="M8.5 17h7M16 7h2.5l-2.5 10M4 14h7l2-3"/>',
  Analytics: '<path d="M5 20V11M11 20V5M17 20v-6M3 20h18"/>',
  Riders: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  Scooters: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 12h10"/>',
  Workshop: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  Enquiries: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/>',
  Documents: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 14l2 2 4-4"/>',
  Payments: '<path d="M7 5h10M7 9h10M9 5c5 0 5 8 0 8H7l7 7"/>',
  Alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
  Battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2M6 11v2"/>',
  Access: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  "Log out": '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
};

export default function Icon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: PATHS[name] ?? "" }} />;
}
