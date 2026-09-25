"use client";

import { useRouter } from "next/navigation";
import { markScooterAvailable } from "@/app/riders/actions";

export default function MarkAvailable({ id }: { id: number }) {
  const router = useRouter();
  return (
    <button className="a" onClick={async () => {
      if (!confirm("Mark this scooter as checked and ready for the next rider?")) return;
      await markScooterAvailable(id);
      router.refresh();
    }}>Mark ready</button>
  );
}
