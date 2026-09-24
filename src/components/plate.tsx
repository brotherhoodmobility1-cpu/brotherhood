export default function Plate({ code }: { code: string }) {
  return (
    <span className="inline-block bg-green-700 text-white text-xs font-bold tracking-wider px-2 py-0.5 rounded ring-1 ring-inset ring-white/60 whitespace-nowrap">
      {code}
    </span>
  );
}