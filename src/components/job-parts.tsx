"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { rupees } from "@/lib/format";
import { canReadBarcodes, readBarcode } from "@/lib/barcode";
import { currentPlace, stampPhoto, stampedPath } from "@/lib/stamp";
import type { Job } from "@/lib/jobs";
import type { StockItem } from "@/lib/parts";

const OTHER = "other";

function Stepper({ value, min = 1, max, onChange, disabled }: { value: number; min?: number; max?: number; onChange: (n: number) => void; disabled?: boolean }) {
  const btn = { width: 40, height: 40, borderRadius: 10, border: "1.5px solid var(--line)", background: "var(--card)", color: "var(--ink)", fontSize: 20, fontWeight: 800, cursor: "pointer" } as const;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button type="button" style={btn} aria-label="One less" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>−</button>
      <b style={{ minWidth: 26, textAlign: "center", fontSize: 18 }}>{value}</b>
      <button type="button" style={btn} aria-label="One more" disabled={disabled || (max != null && value >= max)} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}

export default function JobParts({ j, stock, urls, onBig }: { j: Job; stock: StockItem[]; urls: Record<string, string>; onBig: (u: string) => void }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState("");
  const [qty, setQty] = useState(1);
  const [otherName, setOtherName] = useState("");
  const [otherPrice, setOtherPrice] = useState("");
  const [photo, setPhoto] = useState<{ path: string; preview: string } | null>(null);
  const [barcode, setBarcode] = useState("");
  const [noBarcode, setNoBarcode] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [place, setPlace] = useState("");
  useEffect(() => { if (open) currentPlace().then(setPlace); }, [open]);

  const item = stock.find((s) => String(s.id) === pick);
  const price = item ? Number(item.unit_price) : Number(otherPrice) || 0;
  const name = item ? item.name : otherName.trim();
  const options = useMemo(() => stock.filter((s) => !q || `${s.name} ${s.barcode ?? ""}`.toLowerCase().includes(q.toLowerCase())), [stock, q]);

  function reset() {
    setPick(""); setQty(1); setOtherName(""); setOtherPrice(""); setPhoto(null); setBarcode(""); setNoBarcode(false); setErr(""); setInfo(""); setQ("");
  }

  async function takePhoto(file?: File) {
    if (!file) return;
    setBusy("photo"); setErr(""); setInfo("");
    try {
      const code = await readBarcode(file);
      const blob = await stampPhoto(file, `${j.scooters?.code ?? ""} · part · ${name || "spare part"}`, place);
      const path = stampedPath(`${j.id}/part-${Date.now()}`);
      const { error } = await supabase.storage.from("job-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setPhoto({ path, preview: URL.createObjectURL(blob) });
      if (code) { setBarcode(code); setNoBarcode(false); setInfo(`Barcode read from the photo: ${code}`); }
      else setInfo(canReadBarcodes() ? "Couldn't read the barcode from the photo. Tap Scan barcode for a close-up, or type it." : "Type the barcode number below.");
      // If the barcode matches a stock item, pick it automatically
      if (code && !pick) { const m = stock.find((s) => s.barcode && s.barcode === code); if (m) setPick(String(m.id)); }
    } catch { setErr("Couldn't upload the photo. Please try again."); }
    setBusy("");
  }

  async function scanOnly(file?: File) {
    if (!file) return;
    setBusy("scan");
    const code = await readBarcode(file);
    setBusy("");
    if (code) { setBarcode(code); setNoBarcode(false); setInfo(`Barcode read: ${code}`); } else setInfo("No barcode found in that photo. Try closer, with good light, or type it.");
  }

  async function save() {
    setErr("");
    if (!pick) return setErr("Choose the part from the list.");
    if (pick === OTHER && (!otherName.trim() || otherPrice === "")) return setErr("Enter the part name and its price.");
    if (item && qty > item.quantity) return setErr(`Only ${item.quantity} of ${item.name} in stock.`);
    if (!photo) return setErr("Take a photo of the part with its barcode.");
    if (!noBarcode && !barcode.trim()) return setErr("Add the barcode number, or tick \"This part has no barcode\".");
    setBusy("save");
    const bc = noBarcode ? null : barcode.trim();
    const { error } = item
      ? await supabase.rpc("add_job_part", { p_job: j.id, p_part: item.id, p_qty: qty, p_photo: photo.path, p_barcode: bc })
      : await supabase.from("job_parts").insert({ job_id: j.id, name: otherName.trim(), qty, unit_price: price, cost: price * qty, photo_path: photo.path, barcode: bc });
    setBusy("");
    if (error) return setErr(error.message.includes("stock") ? error.message : "Couldn't add the part. Please try again.");
    reset(); setOpen(false); router.refresh();
  }

  async function changeQty(id: number, n: number) {
    setBusy(`q${id}`); setErr("");
    const { error } = await supabase.rpc("set_job_part_qty", { p_id: id, p_qty: n });
    setBusy("");
    if (error) setErr(error.message); else router.refresh();
  }
  async function remove(id: number) {
    if (!confirm("Remove this part from the job? It goes back into stock.")) return;
    setBusy(`r${id}`);
    const { error } = await supabase.rpc("remove_job_part", { p_id: id });
    setBusy("");
    if (error) setErr(error.message); else router.refresh();
  }

  return (
    <>
      <label>Spare parts fitted</label>
      {j.job_parts.length === 0 && <p className="mute" style={{ margin: "0 0 8px" }}>No parts yet.</p>}
      {j.job_parts.map((p) => (
        <div className="pt" key={p.id} style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ display: "flex", gap: 10, alignItems: "center", flex: "1 1 180px", minWidth: 0 }}>
            {p.photo_path && urls[p.photo_path] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[p.photo_path]} alt="" onClick={() => onBig(urls[p.photo_path!])} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, cursor: "zoom-in", flex: "none" }} />
            ) : <span style={{ width: 48, height: 48, border: "1px dashed var(--mute)", borderRadius: 8, flex: "none" }} />}
            <span style={{ minWidth: 0 }}>
              <b>{p.name}</b>
              <small className="mute" style={{ display: "block" }}>
                {p.barcode ? `Barcode ${p.barcode}` : "No barcode"} · {rupees(p.unit_price ?? Number(p.cost) / (p.qty || 1))} each
              </small>
            </span>
          </span>
          <Stepper value={p.qty ?? 1} disabled={!!busy} max={p.part_id ? (p.qty ?? 1) + (stock.find((s) => s.id === p.part_id)?.quantity ?? 0) : undefined}
            onChange={(n) => changeQty(p.id, n)} />
          <b style={{ minWidth: 70, textAlign: "right" }}>{rupees(p.cost)}</b>
          <button className="a" disabled={!!busy} onClick={() => remove(p.id)}>Remove</button>
        </div>
      ))}

      {!open ? (
        <button className="a p" style={{ margin: "8px 0 4px" }} onClick={() => { reset(); setOpen(true); }}>+ Add part</button>
      ) : (
        <div className="row" style={{ display: "block", marginTop: 8 }}>
          <b>Add a part</b>
          {stock.length > 6 && <input type="search" placeholder="Search part name or barcode" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginTop: 8 }} />}
          <select value={pick} onChange={(e) => { setPick(e.target.value); setQty(1); }} style={{ marginTop: 8 }}>
            <option value="">Choose the part…</option>
            {options.map((s) => (
              <option key={s.id} value={s.id} disabled={s.quantity <= 0}>
                {s.name} · {rupees(s.unit_price)} · {s.quantity > 0 ? `${s.quantity} in stock` : "out of stock"}
              </option>
            ))}
            <option value={OTHER}>Other part (not in the stock list)</option>
          </select>
          {pick === OTHER && (
            <div style={{ display: "flex", gap: 6 }}>
              <input placeholder="Part name" value={otherName} onChange={(e) => setOtherName(e.target.value)} />
              <input type="number" placeholder="Price ₹" value={otherPrice} onChange={(e) => setOtherPrice(e.target.value)} style={{ maxWidth: 110 }} />
            </div>
          )}
          {pick && (
            <div className="pt" style={{ alignItems: "center" }}>
              <span>How many</span>
              <Stepper value={qty} max={item ? item.quantity : undefined} onChange={setQty} />
              <b>{qty} × {rupees(price)} = {rupees(price * qty)}</b>
            </div>
          )}

          <label style={{ marginTop: 10 }}>Photo of the part with its barcode</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={photo.preview} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />
              : <span style={{ width: 64, height: 64, border: "1px dashed var(--mute)", borderRadius: 8, display: "inline-block" }} />}
            <label style={{ border: "1.5px solid var(--line)", padding: "9px 13px", borderRadius: 10, cursor: "pointer", color: "var(--ink)", fontWeight: 700, margin: 0 }}>
              {busy === "photo" ? "Uploading…" : photo ? "Retake photo" : "📷 Take photo"}
              <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={!!busy}
                onChange={(e) => { takePhoto(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
          <p className="mute" style={{ fontSize: 13, margin: "4px 0 0" }}>Keep the barcode sticker clearly visible in the photo. It is stamped with the date, time and place.</p>

          <label style={{ marginTop: 10 }}>Barcode number</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input value={barcode} disabled={noBarcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Read from the photo, or type it" style={{ margin: 0 }} />
            {canReadBarcodes() && (
              <label style={{ border: "1.5px solid var(--line)", padding: "9px 12px", borderRadius: 10, cursor: "pointer", color: "var(--ink)", fontWeight: 700, margin: 0, whiteSpace: "nowrap" }}>
                {busy === "scan" ? "Reading…" : "Scan barcode"}
                <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={!!busy || noBarcode}
                  onChange={(e) => { scanOnly(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            )}
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink)", fontSize: 14, margin: "8px 0" }}>
            <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={noBarcode} onChange={(e) => setNoBarcode(e.target.checked)} />
            This part has no barcode
          </label>
          {info && <p className="mute" style={{ fontSize: 13 }}>{info}</p>}
          {err && <p className="lerr" role="alert">{err}</p>}
          <div className="btns">
            <button className="a" onClick={() => { reset(); setOpen(false); }} disabled={busy === "save"}>Cancel</button>
            <button className="a p" onClick={save} disabled={!!busy}>{busy === "save" ? "Saving…" : "Add part"}</button>
          </div>
        </div>
      )}
      {err && !open && <p className="lerr" role="alert">{err}</p>}
    </>
  );
}
