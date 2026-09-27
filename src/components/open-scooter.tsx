"use client";

import { useState } from "react";
import ScooterFile from "./scooter-file";

export default function OpenScooter({ id, owner, label = "Open" }: { id: number; owner: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="a" onClick={() => setOpen(true)}>{label}</button>
      {open && <ScooterFile scooterId={id} owner={owner} onClose={() => setOpen(false)} />}
    </>
  );
}
