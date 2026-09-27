/** Takes a live photo, shrinks it, and stamps "Brotherhood Mobility · label · date time · location" on it. */
export async function currentPlace(): Promise<string> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "";
  return new Promise((res) => navigator.geolocation.getCurrentPosition(
    (p) => res(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`),
    () => res(""),
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
  ));
}

export async function stampPhoto(file: File, label: string, place: string, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * sc), h = Math.round(bmp.height * sc);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d")!;
  x.drawImage(bmp, 0, 0, w, h);
  const now = new Date().toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" });
  const lines = [`Brotherhood Mobility · ${label}`, `${now} IST${place ? ` · ${place}` : ""}`];
  const fs = Math.max(16, Math.round(w / 38));
  const pad = Math.round(fs * 0.6), bar = lines.length * fs * 1.35 + pad * 2;
  x.fillStyle = "rgba(0,0,0,0.6)";
  x.fillRect(0, h - bar, w, bar);
  x.fillStyle = "#f2b705";
  x.font = `700 ${fs}px system-ui, sans-serif`;
  x.fillText(lines[0], pad, h - bar + pad + fs);
  x.fillStyle = "#ffffff";
  x.font = `500 ${Math.round(fs * 0.9)}px system-ui, sans-serif`;
  x.fillText(lines[1], pad, h - bar + pad + fs * 2.3);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("Could not read the photo"))), "image/jpeg", 0.82));
}

export const stampedPath = (base: string) => `${base}__src-stamp-${Date.now()}.jpg`;
