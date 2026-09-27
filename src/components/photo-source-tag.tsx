import { sourceLabel } from "@/lib/photo-source";

export default function PhotoSourceTag({ path }: { path: string | null | undefined }) {
  const l = sourceLabel(path);
  if (!l) return null;
  return <span className={`tag ${l[0]}`} style={{ fontSize: 11.5, whiteSpace: "normal" }}>{l[1]}</span>;
}
