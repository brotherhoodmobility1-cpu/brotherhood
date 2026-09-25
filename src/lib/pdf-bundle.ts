import type { BundleData } from "@/app/documents/bundle";
import { formatDate, perDay, rupees } from "./format";

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, no) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => ok(i);
    i.onerror = () => no(new Error("A photo could not be read"));
    i.src = src;
  });
}

async function pages(b: BundleData): Promise<HTMLCanvasElement[]> {
  const W = 1240, H = 1754, MG = 90, CW = W - 2 * MG, BOT = H - 100;
  const F = 'Mukta, "Noto Sans Devanagari", "Nirmala UI", Mangal, system-ui, sans-serif';
  const out: HTMLCanvasElement[] = [];
  let c!: HTMLCanvasElement, x!: CanvasRenderingContext2D, y = 0;
  const np = () => {
    c = document.createElement("canvas"); c.width = W; c.height = H;
    x = c.getContext("2d")!;
    x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#5d7076"; x.font = `22px ${F}`;
    x.fillText(`Brotherhood Mobility · ${b.name} · ${b.code} · chassis ${b.chassis ?? "–"}`, MG, 60);
    const pg = `Page ${out.length + 1}`;
    x.fillText(pg, W - MG - x.measureText(pg).width, H - 45);
    x.fillText("Confidential rider record", MG, H - 45);
    x.strokeStyle = "#dbe3e0"; x.lineWidth = 2; x.beginPath(); x.moveTo(MG, 80); x.lineTo(W - MG, 80); x.stroke();
    out.push(c); y = 130;
  };
  const tx = (t: string, sz: number, wt = "400", col = "#16252a", after = 0) => {
    const f = `${wt} ${sz}px ${F}`, lh = Math.round(sz * 1.5), lines: string[] = [];
    let cur = "";
    x.font = f;
    for (const w of t.split(/\s+/)) {
      const q = cur ? `${cur} ${w}` : w;
      if (x.measureText(q).width > CW && cur) { lines.push(cur); cur = w; } else cur = q;
    }
    if (cur) lines.push(cur);
    for (const l of lines) {
      if (y + lh > BOT) np();
      x.font = f; x.fillStyle = col; x.fillText(l, MG, y + sz); y += lh;
    }
    y += after;
  };
  const kv = (k: string, v: string) => {
    if (y + 44 > BOT) np();
    x.font = `400 26px ${F}`; x.fillStyle = "#5d7076"; x.fillText(k, MG, y + 26);
    x.font = `700 26px ${F}`; x.fillStyle = "#16252a"; x.fillText(v, MG + 360, y + 26); y += 44;
  };
  const signedAt = b.agreement ? new Date(b.agreement.signed_at).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" }) : "";

  np();
  try { const lg = await loadImg("/brand/logo-mark.jpg"); x.drawImage(lg, W - MG - 140, 105, 140, 140); } catch { /* logo optional */ }
  tx("Rider document bundle", 46, "800", "#0d7a68", 6);
  tx(`Generated ${formatDate(new Date().toISOString().slice(0, 10))} for owner and staff records`, 24, "400", "#5d7076", 30);
  kv("Rider", b.name); kv("Mobile", b.mobile ?? "Not set"); kv("Scooter", b.code); kv("Chassis no.", b.chassis ?? "–");
  kv("Start date", formatDate(b.start)); kv("Weekly rent", `${rupees(b.rent)} (${rupees(perDay(b.rent))} per day)`);
  kv("Security deposit", rupees(b.deposit)); kv("Documents", `${b.docs.length} verified`);
  kv("Agreement", b.agreement ? `Signed ${signedAt} · version ${b.agreement.version}` : "Not signed");

  if (b.agreement) {
    np();
    b.agreement.body.split("\n").filter((l) => l.trim()).forEach((l, i) =>
      i === 0 ? tx(l, 34, "800", "#16252a", 14) : tx(l, 24, "400", "#16252a", /[\u0900-\u097F]/.test(l) ? 18 : 4));
    if (y + 190 > BOT) np();
    y += 10; x.strokeStyle = "#0d7a68"; x.lineWidth = 3; x.strokeRect(MG, y, CW, 160); const sy = y + 24;
    x.fillStyle = "#0d7a68"; x.font = `800 28px ${F}`; x.fillText("Signed electronically", MG + 24, sy + 26);
    x.fillStyle = "#16252a"; x.font = `400 24px ${F}`;
    x.fillText(`By ${b.name} · mobile ${b.agreement.mobile ?? "not set"}`, MG + 24, sy + 68);
    x.fillText(`${signedAt} · confirmed with password · version ${b.agreement.version}`, MG + 24, sy + 106);
    y = sy + 160;
  }

  const HB = Math.floor((BOT - 130) / 2) - 80;
  let first = true;
  for (const d of b.docs) {
    if (first || y + HB + 70 > BOT) np();
    first = false;
    tx(`${d.group}: ${d.label}  ✓ Verified`, 26, "700", "#16252a", 8);
    const im = await loadImg(d.url);
    const sc = Math.min(CW / im.width, HB / im.height), iw = im.width * sc, ih = im.height * sc;
    x.fillStyle = "#f2f5f3"; x.fillRect(MG, y, CW, HB);
    x.drawImage(im, MG + (CW - iw) / 2, y + (HB - ih) / 2, iw, ih);
    y += HB + 40;
  }
  return out;
}

function toPdf(cs: HTMLCanvasElement[]): Blob {
  const en = new TextEncoder(), parts: Uint8Array[] = [], off: number[] = [];
  let len = 0;
  const add = (p: string | Uint8Array) => { const b = typeof p === "string" ? en.encode(p) : p; parts.push(b); len += b.length; };
  const obj = (i: number, f: () => void) => { off[i] = len; add(`${i} 0 obj\n`); f(); add("\nendobj\n"); };
  const n = cs.length, size = 3 + 3 * n;
  add("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
  obj(1, () => add("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => add(`<< /Type /Pages /Kids [${cs.map((_, i) => `${3 + 3 * i} 0 R`).join(" ")}] /Count ${n} >>`));
  cs.forEach((c, i) => {
    const pg = 3 + 3 * i, ct = pg + 1, im = pg + 2;
    const bin = atob(c.toDataURL("image/jpeg", 0.85).split(",")[1]);
    const b = new Uint8Array(bin.length);
    for (let q = 0; q < bin.length; q++) b[q] = bin.charCodeAt(q);
    const cmd = "q 595.28 0 0 841.89 0 0 cm /Im0 Do Q";
    obj(pg, () => add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`));
    obj(ct, () => add(`<< /Length ${cmd.length} >>\nstream\n${cmd}\nendstream`));
    obj(im, () => { add(`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${b.length} >>\nstream\n`); add(b); add("\nendstream"); });
  });
  const xs = len;
  let xr = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let i = 1; i < size; i++) xr += `${String(off[i]).padStart(10, "0")} 00000 n \n`;
  add(`${xr}trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xs}\n%%EOF`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

export async function downloadBundle(b: BundleData) {
  const blob = toPdf(await pages(b));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Brotherhood-${b.code}-${b.name.replace(/[^A-Za-z0-9]+/g, "-")}-documents.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
