/**
 * Works out whether a picked photo was taken live or came from the gallery, using the photo's own
 * camera date (EXIF) where available. The result is saved in the file name, e.g. "...__src-live-1727431200000.jpg".
 */
export type PhotoSource = { src: "live" | "gal" | "none"; ts: number };

const LIVE_MINUTES = 10;

function readAscii(v: DataView, off: number, len: number) {
  let s = "";
  for (let i = 0; i < len && off + i < v.byteLength; i++) {
    const c = v.getUint8(off + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

/** Reads DateTimeOriginal (or DateTime) from a JPEG's EXIF block. */
export async function readExifDate(file: File): Promise<Date | null> {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xffd8) return null;
    let p = 2;
    while (p + 4 < v.byteLength) {
      const marker = v.getUint16(p);
      const size = v.getUint16(p + 2);
      if (marker === 0xffe1 && readAscii(v, p + 4, 4) === "Exif") {
        const t = p + 10;
        const le = v.getUint16(t) === 0x4949;
        const u16 = (o: number) => v.getUint16(t + o, le);
        const u32 = (o: number) => v.getUint32(t + o, le);
        const findTag = (ifd: number, tag: number) => {
          const n = u16(ifd);
          for (let i = 0; i < n; i++) {
            const e = ifd + 2 + i * 12;
            if (u16(e) === tag) return e;
          }
          return -1;
        };
        const asDate = (entry: number) => {
          if (entry < 0) return null;
          const m = readAscii(v, t + u32(entry + 8), 19).match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
          return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
        };
        const ifd0 = u32(4);
        const exifPtr = findTag(ifd0, 0x8769);
        if (exifPtr >= 0) {
          const d = asDate(findTag(u32(exifPtr + 8), 0x9003));
          if (d) return d;
        }
        return asDate(findTag(ifd0, 0x0132));
      }
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
      p += 2 + size;
    }
  } catch { /* no readable EXIF */ }
  return null;
}

export async function detectSource(file: File): Promise<PhotoSource> {
  const d = await readExifDate(file);
  if (!d) return { src: "none", ts: file.lastModified || Date.now() };
  const ageMin = (Date.now() - d.getTime()) / 60000;
  return { src: ageMin <= LIVE_MINUTES && ageMin > -LIVE_MINUTES ? "live" : "gal", ts: d.getTime() };
}

/** Builds a storage file name that carries the photo source. */
export const taggedPath = (base: string, s: PhotoSource) => `${base}__src-${s.src}-${s.ts}.jpg`;

export function parseSource(path: string | null | undefined): PhotoSource | null {
  const m = path?.match(/__src-(live|gal|none|stamp)-(\d+)\.jpg$/);
  if (!m) return null;
  return { src: (m[1] === "stamp" ? "live" : m[1]) as PhotoSource["src"], ts: Number(m[2]) };
}

const when = (ts: number) =>
  new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** [tag class, text] to show owner and staff. */
export function sourceLabel(path: string | null | undefined): [string, string] | null {
  const s = parseSource(path);
  if (!s) return null;
  if (path?.includes("__src-stamp-")) return ["", `📷 Live camera · stamped ${when(s.ts)}`];
  if (s.src === "live") return ["", `🟢 Taken live · ${when(s.ts)}`];
  if (s.src === "gal") return ["due", `🟡 From gallery · photo date ${when(s.ts)}`];
  return ["bad", "⚪ No camera info (screenshot or forwarded photo)"];
}
