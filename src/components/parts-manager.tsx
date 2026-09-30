"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import Empty from "./empty";
import { createClient } from "@/lib/supabase/client";
import { rupees } from "@/lib/format";
import { whenIST } from "@/lib/ist";
import { lowStock, type StockItem } from "@/lib/parts";
import { addStockItem, archiveStockItem, correctStock, editStockItem, stockIn } from "@/app/parts/actions";

type Move = { id: number; change: number; kind: string; unit_price: number | null; note: string | null; created_at: string; jobs: { ticket: string; scooters: { code: string } | null } | null };
const KIND: Record<string, string> = { stock_in: "Stock in", used: "Used on scooter", returned: "Put back", adjust: "Count corrected" };

export default function PartsManager({ owner, items, used30 }: { owner: boolean; items: StockItem[]; used30: Record<string, number> }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [add, setAdd] = useState<{ name: string; barcode: string; qty: string; price: string; min: string } | null>(null);
  const [inn, setInn] = useState<{ it: StockItem; qty: string; price: string; note: string } | null>(null);
  const [edit, setEdit] = useState<{ it: StockItem; name: string; barcode: string; price: string; min: string; count: string } | null>(null);
  const [hist, setHist] = useState<{ it: StockItem; rows: Move[] | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const value = items.reduce((a, i) => a + i.quantity * Number(i.unit_price), 0);
  const low = items.filter(lowStock);
  const shown = items.filter((i) => (!onlyLow || lowStock(i)) && (!q || `${i.name} ${i.barcode ?? ""}`.toLowerCase().includes(q.toLowerCase())));

  async function run(fn: () => Promise<{ ok: boolean; error: string }>, done: string, close: () => void) {
    setBusy(true); setErr("");
    let r: { ok: boolean; error: string };
    try { r = await fn(); } catch { r = { ok: false, error: "Something went wrong. Please try again." }; }
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    close(); setOk(done); router.refresh();
  }

  async function openHistory(it: StockItem) {
    setHist({ it, rows: null });
    const { data } = await createClient().from("stock_movements")
      .select("id, change, kind, unit_price, note, created_at, jobs(ticket, scooters(code))").eq("part_id", it.id)
      .order("created_at", { ascending: false }).limit(50);
    setHist({ it, rows: (data ?? []) as unknown as Move[] });
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Spare parts stock</h2>
        <button className="a p" onClick={() => { setErr(""); setAdd({ name: "", barcode: "", qty: "", price: "", min: "2" }); }}>+ Add spare part</button>
      </div>
      <div className="stats" style={{ marginTop: 12 }}>
        <div className="stat"><b>{items.length}</b><span>Different parts</span></div>
        <div className="stat"><b>{items.reduce((a, i) => a + i.quantity, 0)}</b><span>Pieces in stock</span></div>
        <div className="stat"><b style={{ fontSize: 22 }}>{rupees(value)}</b><span>Total stock value</span></div>
        <div className="stat"><b style={{ color: low.length ? "var(--bad)" : undefined }}>{low.length}</b><span>Low or out of stock</span></div>
      </div>
      {err && <p className="lerr" role="alert">{err}</p>}
      {ok && <p className="tag" style={{ display: "inline-block" }}>{ok}</p>}
      <div className="chips">
        <button className={`chip${!onlyLow ? " on" : ""}`} onClick={() => setOnlyLow(false)}>All <b>{items.length}</b></button>
        <button className={`chip${onlyLow ? " on" : ""}`} onClick={() => setOnlyLow(true)}><i className="bad" />Low or out of stock <b>{low.length}</b></button>
      </div>
      <input type="search" placeholder="Search part name or barcode" value={q} onChange={(e) => setQ(e.target.value)} />

      {shown.length === 0 ? <Empty text={items.length ? "No part matches." : "No spare parts yet. Tap + Add spare part to start your stock list."} /> : (
        <div style={{ overflowX: "auto" }}>
          <table className="tb">
            <thead><tr><th>Part</th><th>In stock</th><th>Price each</th><th>Total value</th><th>Used (30 days)</th><th /></tr></thead>
            <tbody>
              {shown.map((i) => (
                <tr key={i.id}>
                  <td><b>{i.name}</b>{i.barcode ? <><br /><small className="mute">Barcode {i.barcode}</small></> : null}</td>
                  <td>
                    <b style={{ fontSize: 17 }}>{i.quantity}</b>{" "}
                    {i.quantity <= 0 ? <span className="tag bad">Out of stock</span> : lowStock(i) ? <span className="tag due">Low</span> : null}
                  </td>
                  <td>{rupees(i.unit_price)}</td>
                  <td>{rupees(i.quantity * Number(i.unit_price))}</td>
                  <td>{used30[i.id] ?? 0}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="a p" onClick={() => { setErr(""); setInn({ it: i, qty: "", price: String(i.unit_price), note: "" }); }}>+ Stock in</button>{" "}
                    <button className="a" onClick={() => { setErr(""); setEdit({ it: i, name: i.name, barcode: i.barcode ?? "", price: String(i.unit_price), min: String(i.min_stock), count: String(i.quantity) }); }}>Edit</button>{" "}
                    <button className="a" onClick={() => openHistory(i)}>History</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">When the mechanic fits a part on a scooter, it is taken from this stock automatically. Removing it from the job puts it back.</p>

      <Modal open={!!add} onClose={() => !busy && setAdd(null)}>
        {add && (
          <>
            <h2>Add a spare part</h2>
            <label>Part name</label><input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="e.g. Brake shoe (rear)" />
            <label>Barcode (optional)</label><input value={add.barcode} onChange={(e) => setAdd({ ...add, barcode: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><label>Quantity</label><input type="number" inputMode="numeric" value={add.qty} onChange={(e) => setAdd({ ...add, qty: e.target.value })} /></div>
              <div style={{ flex: 1 }}><label>Price per piece (₹)</label><input type="number" inputMode="decimal" value={add.price} onChange={(e) => setAdd({ ...add, price: e.target.value })} /></div>
            </div>
            <p><b>Total cost: {rupees((Number(add.qty) || 0) * (Number(add.price) || 0))}</b></p>
            <label>Warn me when stock is at or below</label><input type="number" inputMode="numeric" value={add.min} onChange={(e) => setAdd({ ...add, min: e.target.value })} />
            {err && <p className="lerr">{err}</p>}
            <div className="btns">
              <button className="a" onClick={() => setAdd(null)} disabled={busy}>Cancel</button>
              <button className="a p" disabled={busy} onClick={() => run(() => addStockItem(add.name, add.barcode, Number(add.qty) || 0, Number(add.price) || 0, Number(add.min) || 0), `${add.name} added.`, () => setAdd(null))}>
                {busy ? "Saving…" : "Add part"}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!inn} onClose={() => !busy && setInn(null)}>
        {inn && (
          <>
            <h2>Stock in: {inn.it.name}</h2>
            <p className="mute">Now in stock: {inn.it.quantity}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><label>How many arrived</label><input type="number" inputMode="numeric" value={inn.qty} onChange={(e) => setInn({ ...inn, qty: e.target.value })} /></div>
              <div style={{ flex: 1 }}><label>Price per piece (₹)</label><input type="number" inputMode="decimal" value={inn.price} onChange={(e) => setInn({ ...inn, price: e.target.value })} /></div>
            </div>
            <p><b>Total cost: {rupees((Number(inn.qty) || 0) * (Number(inn.price) || 0))}</b> · stock becomes {inn.it.quantity + (Number(inn.qty) || 0)}</p>
            <label>Note (optional)</label><input value={inn.note} onChange={(e) => setInn({ ...inn, note: e.target.value })} placeholder="e.g. Bill no. or supplier" />
            {err && <p className="lerr">{err}</p>}
            <div className="btns">
              <button className="a" onClick={() => setInn(null)} disabled={busy}>Cancel</button>
              <button className="a p" disabled={busy} onClick={() => run(() => stockIn(inn.it.id, Number(inn.qty) || 0, inn.price === "" ? null : Number(inn.price), inn.note), `Stock added for ${inn.it.name}.`, () => setInn(null))}>
                {busy ? "Saving…" : "Add to stock"}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!edit} onClose={() => !busy && setEdit(null)}>
        {edit && (
          <>
            <h2>Edit {edit.it.name}</h2>
            <label>Part name</label><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <label>Barcode</label><input value={edit.barcode} onChange={(e) => setEdit({ ...edit, barcode: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><label>Price per piece (₹)</label><input type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></div>
              <div style={{ flex: 1 }}><label>Low stock warning at</label><input type="number" value={edit.min} onChange={(e) => setEdit({ ...edit, min: e.target.value })} /></div>
            </div>
            {err && <p className="lerr">{err}</p>}
            <div className="btns">
              <button className="a" onClick={() => setEdit(null)} disabled={busy}>Cancel</button>
              <button className="a p" disabled={busy} onClick={() => run(() => editStockItem(edit.it.id, { name: edit.name, barcode: edit.barcode, unit_price: Number(edit.price) || 0, min_stock: Number(edit.min) || 0 }), "Saved.", () => setEdit(null))}>Save</button>
            </div>
            {owner && (
              <>
                <h2>Correct the count (owner)</h2>
                <p className="mute">Use after a physical stock check. Recorded in history.</p>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="number" value={edit.count} onChange={(e) => setEdit({ ...edit, count: e.target.value })} style={{ maxWidth: 120, margin: 0 }} />
                  <button className="a" disabled={busy || Number(edit.count) === edit.it.quantity}
                    onClick={() => run(() => correctStock(edit.it.id, Number(edit.count) || 0, "Stock count correction"), "Count corrected.", () => setEdit(null))}>Set count</button>
                </div>
                <div className="btns" style={{ marginTop: 14 }}>
                  <button className="a d" disabled={busy} onClick={() => { if (confirm(`Remove ${edit.it.name} from the stock list? Its history stays saved.`)) run(() => archiveStockItem(edit.it.id), "Removed from the list.", () => setEdit(null)); }}>Remove from list</button>
                </div>
              </>
            )}
          </>
        )}
      </Modal>

      <Modal open={!!hist} onClose={() => setHist(null)}>
        {hist && (
          <>
            <h2>History: {hist.it.name}</h2>
            <p className="mute">Now in stock: {hist.it.quantity}</p>
            {!hist.rows ? <p className="mute">Loading…</p> : hist.rows.length === 0 ? <p className="mute">No movements yet.</p> : hist.rows.map((m) => (
              <div className="pt" key={m.id}>
                <span>{whenIST(m.created_at)} · {KIND[m.kind] ?? m.kind}{m.jobs ? ` · ${m.jobs.scooters?.code ?? ""} ${m.jobs.ticket}` : ""}{m.note ? ` · ${m.note}` : ""}</span>
                <b style={{ color: m.change < 0 ? "var(--bad)" : "var(--ev)" }}>{m.change > 0 ? "+" : ""}{m.change}</b>
              </div>
            ))}
            <div className="btns"><button className="a p" onClick={() => setHist(null)}>Close</button></div>
          </>
        )}
      </Modal>
    </>
  );
}
