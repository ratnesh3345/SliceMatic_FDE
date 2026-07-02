"use client";
// app/admin/menu/page.js — Menu management. Staff can toggle stock;
// only the owner can add items or edit price/name.
import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";

const BRAND = "#E11D74", INK = "#1A1614", GOOD = "#2F7A4D", MUTED = "#8A7E73", LINE = "#E7DDD2", PAPER = "#FBF6EF";
const CATS = [
  { key: "base", label: "Crusts" },
  { key: "pizza", label: "Pizzas" },
  { key: "topping", label: "Toppings" },
];

function INR(n) { return "₹" + Math.round(n).toLocaleString("en-IN"); }

export default function MenuAdminPage() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null); // {id, name, price}
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ category: "pizza", name: "", price: "", item_code: "" });
  const [addErr, setAddErr] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("sm_user");
      if (stored) setUser(JSON.parse(stored));
    } catch {}
    setChecked(true);
  }, []);

  const isOwner = user?.role === "OWNER" || user?.role === "admin";
  const authed = !!user;

  async function fetchItems() {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/menu/admin");
      const d = await r.json();
      if (!d.ok) throw new Error(d.message);
      setItems(d.items || []);
    } catch (e) { setErr(e.message || "Could not load menu."); }
    setLoading(false);
  }

  useEffect(() => { if (authed) fetchItems(); }, [authed]);

  async function toggleStock(item) {
    setBusyId(item.id);
    try {
      const r = await fetch("/api/menu/admin", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, role: user.role, is_available: !item.is_available }),
      });
      const d = await r.json();
      if (d.ok) setItems((its) => its.map((i) => (i.id === item.id ? d.item : i)));
    } catch {}
    setBusyId(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setBusyId(editing.id);
    try {
      const r = await fetch("/api/menu/admin", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, role: user.role, name: editing.name, price: Number(editing.price) }),
      });
      const d = await r.json();
      if (d.ok) { setItems((its) => its.map((i) => (i.id === editing.id ? d.item : i))); setEditing(null); }
    } catch {}
    setBusyId(null);
  }

  async function addItem() {
    setAddErr("");
    if (!newItem.name.trim() || !newItem.price || !newItem.item_code.trim()) {
      setAddErr("Fill in item code, name, and price."); return;
    }
    try {
      const r = await fetch("/api/menu/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newItem, price: Number(newItem.price), role: user.role }),
      });
      const d = await r.json();
      if (!d.ok) { setAddErr(d.message); return; }
      setItems((its) => [...its, d.item]);
      setNewItem({ category: "pizza", name: "", price: "", item_code: "" });
      setAdding(false);
    } catch { setAddErr("Something went wrong."); }
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map((line) => {
      // simple CSV split respecting quoted commas
      const cells = [];
      let cur = "", inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === "," && !inQuotes) { cells.push(cur); cur = ""; }
        else cur += ch;
      }
      cells.push(cur);
      const row = {};
      headers.forEach((h, i) => { row[h] = (cells[i] || "").trim().replace(/^"|"$/g, ""); });
      return row;
    });
  }

  function exportCsv() {
    const header = ["category", "item_code", "name", "price", "is_available"];
    const rows = items.map((it) => [it.category, it.item_code, `"${it.name}"`, it.price, it.is_available].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "slicematic_menu.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCsvFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null); setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) { setImportResult({ ok: false, message: "CSV appears empty or missing rows." }); setImporting(false); return; }
      const r = await fetch("/api/menu/admin/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, role: user.role }),
      });
      const d = await r.json();
      setImportResult(d);
      if (d.ok) await fetchItems();
    } catch (err) {
      setImportResult({ ok: false, message: String(err) });
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function removeItem(item) {
    if (!confirm(`Remove "${item.name}" from the menu?`)) return;
    setBusyId(item.id);
    try {
      const r = await fetch("/api/menu/admin", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, role: user.role }),
      });
      const d = await r.json();
      if (d.ok) setItems((its) => its.filter((i) => i.id !== item.id));
    } catch {}
    setBusyId(null);
  }

  async function moveItem(item, direction) {
    // direction: "up" (-1) or "down" (+1) within its category
    const catItems = byCategory[item.category];
    const idx = catItems.findIndex((i) => i.id === item.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= catItems.length) return;
    const other = catItems[swapIdx];

    setBusyId(item.id);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/menu/admin", { method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, role: user.role, sort_order: other.sort_order }) }),
        fetch("/api/menu/admin", { method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: other.id, role: user.role, sort_order: item.sort_order }) }),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      if (d1.ok && d2.ok) {
        setItems((its) => its.map((i) => (i.id === d1.item.id ? d1.item : i.id === d2.item.id ? d2.item : i)));
      }
    } catch {}
    setBusyId(null);
  }

  const byCategory = useMemo(() => {
    const g = { base: [], pizza: [], topping: [] };
    for (const it of items) if (g[it.category]) g[it.category].push(it);
    return g;
  }, [items]);

  const outOfStockCount = items.filter((i) => !i.is_available).length;

  if (!checked) return null;
  if (!authed) return (
    <Wrap active="menu" role={user?.role}>
      <Card>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Sign in required</div>
        <p style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>Sign in from the Orders dashboard first.</p>
        <a href="/admin" style={{ display: "inline-block", marginTop: 12, background: BRAND, color: "#fff",
          fontWeight: 700, fontSize: 13, padding: "9px 16px", borderRadius: 12, textDecoration: "none" }}>Go to Orders</a>
      </Card>
    </Wrap>
  );

  return (
    <Wrap active="menu" role={user?.role}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Menu management</h1>
          <p style={{ color: MUTED, fontSize: 13, margin: "4px 0 0" }}>
            {items.length} items · {outOfStockCount > 0 ? <span style={{ color: BRAND }}>{outOfStockCount} out of stock</span> : "all in stock"}
            {!isOwner && <span> · signed in as Staff — you can toggle stock; ask an owner to change prices</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportCsv}
            style={{ background: "#fff", color: INK, fontWeight: 700, fontSize: 13, padding: "9px 16px",
              borderRadius: 12, border: `1px solid ${LINE}`, cursor: "pointer" }}>
            ⬇ Export CSV
          </button>
          {isOwner && (
            <>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvFile} style={{ display: "none" }} />
              <button onClick={() => fileInputRef.current?.click()} disabled={importing}
                style={{ background: "#fff", color: INK, fontWeight: 700, fontSize: 13, padding: "9px 16px",
                  borderRadius: 12, border: `1px solid ${LINE}`, cursor: importing ? "wait" : "pointer",
                  opacity: importing ? 0.6 : 1 }}>
                {importing ? "Importing…" : "⬆ Import CSV"}
              </button>
              <button onClick={() => setAdding((a) => !a)}
                style={{ background: BRAND, color: "#fff", fontWeight: 700, fontSize: 13, padding: "9px 16px",
                  borderRadius: 12, border: "none", cursor: "pointer" }}>
                {adding ? "Cancel" : "+ Add item"}
              </button>
            </>
          )}
        </div>
      </div>

      {importResult && (
        <Card style={{ marginTop: 12, background: importResult.ok ? "#f0f9f4" : "#fdeef5",
          border: `1px solid ${importResult.ok ? "#bbf7d0" : "#f4a9cd"}` }}>
          {importResult.ok ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: GOOD }}>
                ✓ Import complete — {importResult.inserted} added, {importResult.updated} updated
                {importResult.errorCount > 0 && `, ${importResult.errorCount} skipped`}
              </div>
              {importResult.errors?.length > 0 && (
                <ul style={{ fontSize: 12, color: MUTED, marginTop: 6, paddingLeft: 18 }}>
                  {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: BRAND }}>⚠ {importResult.message}</div>
          )}
          <button onClick={() => setImportResult(null)}
            style={{ marginTop: 8, fontSize: 12, color: MUTED, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            Dismiss
          </button>
        </Card>
      )}

      {adding && isOwner && (
        <Card style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Add a new menu item</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
            <select value={newItem.category} onChange={(e) => setNewItem((n) => ({ ...n, category: e.target.value }))}
              style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 13 }}>
              {CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input placeholder="Name e.g. Veggie Supreme" value={newItem.name}
              onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))}
              style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 13 }} />
            <input placeholder="Price" type="number" value={newItem.price}
              onChange={(e) => setNewItem((n) => ({ ...n, price: e.target.value }))}
              style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 13 }} />
            <input placeholder="Code e.g. P9" value={newItem.item_code}
              onChange={(e) => setNewItem((n) => ({ ...n, item_code: e.target.value }))}
              style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 13 }} />
            <button onClick={addItem}
              style={{ background: GOOD, color: "#fff", fontWeight: 700, fontSize: 13, padding: "8px 14px",
                borderRadius: 10, border: "none", cursor: "pointer" }}>Save</button>
          </div>
          {addErr && <div style={{ color: BRAND, fontSize: 12, marginTop: 8 }}>{addErr}</div>}
        </Card>
      )}

      {loading ? (
        <p style={{ color: MUTED, marginTop: 20 }}>Loading menu…</p>
      ) : err ? (
        <Card style={{ marginTop: 14 }}>
          <b>Couldn't load menu.</b>
          <div style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>{err}</div>
          <div style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>Run <code>menu_setup.sql</code> in Supabase first.</div>
        </Card>
      ) : (
        CATS.map((cat) => (
          <div key={cat.key} style={{ marginTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>{cat.label}</div>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {byCategory[cat.key].map((item, idx) => {
                const isEditing = editing?.id === item.id;
                return (
                  <div key={item.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    borderTop: idx > 0 ? `1px solid ${LINE}` : "none",
                    opacity: item.is_available ? 1 : 0.55,
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                      <button onClick={() => moveItem(item, "up")} disabled={idx === 0 || busyId === item.id}
                        title="Move up" style={{ width: 20, height: 16, border: "none", background: "none",
                        cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "#d4cabf" : MUTED, fontSize: 10,
                        lineHeight: "16px", padding: 0 }}>▲</button>
                      <button onClick={() => moveItem(item, "down")} disabled={idx === byCategory[item.category].length - 1 || busyId === item.id}
                        title="Move down" style={{ width: 20, height: 16, border: "none", background: "none",
                        cursor: idx === byCategory[item.category].length - 1 ? "default" : "pointer",
                        color: idx === byCategory[item.category].length - 1 ? "#d4cabf" : MUTED, fontSize: 10,
                        lineHeight: "16px", padding: 0 }}>▼</button>
                    </div>

                    <button onClick={() => toggleStock(item)} disabled={busyId === item.id}
                      title={item.is_available ? "Mark out of stock" : "Mark in stock"}
                      style={{
                        width: 42, height: 24, borderRadius: 999, border: "none", cursor: "pointer",
                        background: item.is_available ? GOOD : "#d4cabf", position: "relative",
                        flexShrink: 0, opacity: busyId === item.id ? 0.5 : 1,
                      }}>
                      <span style={{
                        position: "absolute", top: 3, left: item.is_available ? 21 : 3,
                        width: 18, height: 18, borderRadius: "50%", background: "#fff",
                        transition: "left .15s ease", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
                      }} />
                    </button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input value={editing.name} onChange={(e) => setEditing((v) => ({ ...v, name: e.target.value }))}
                            style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 13 }} />
                          <input value={editing.price} type="number" onChange={(e) => setEditing((v) => ({ ...v, price: e.target.value }))}
                            style={{ width: 90, padding: "6px 10px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 13 }} />
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>
                            {item.name}
                            {!item.is_available && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: BRAND, background: "#fdeef5",
                                padding: "1px 7px", borderRadius: 999, marginLeft: 8 }}>OUT OF STOCK</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: MUTED }}>{item.item_code}</div>
                        </>
                      )}
                    </div>

                    {!isEditing && <div style={{ fontSize: 14, fontWeight: 700, width: 80, textAlign: "right" }}>{INR(item.price)}</div>}

                    {isOwner && (
                      isEditing ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={saveEdit} disabled={busyId === item.id}
                            style={{ background: GOOD, color: "#fff", border: "none", borderRadius: 8,
                              padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
                          <button onClick={() => setEditing(null)}
                            style={{ background: "none", border: `1px solid ${LINE}`, borderRadius: 8,
                              padding: "6px 10px", fontSize: 12, cursor: "pointer", color: MUTED }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => setEditing({ id: item.id, name: item.name, price: item.price })}
                            style={{ background: "none", border: `1px solid ${LINE}`, borderRadius: 8,
                              padding: "6px 10px", fontSize: 12, cursor: "pointer", color: INK }}>Edit</button>
                          <button onClick={() => removeItem(item)}
                            style={{ background: "none", border: `1px solid ${LINE}`, borderRadius: 8,
                              padding: "6px 10px", fontSize: 12, cursor: "pointer", color: BRAND }}>Remove</button>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </Card>
          </div>
        ))
      )}
    </Wrap>
  );
}

function Card({ children, style }) {
  return <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16,
    boxShadow: "0 1px 2px rgba(26,22,20,.04), 0 8px 24px rgba(26,22,20,.05)", padding: 16, ...style }}>{children}</div>;
}

function Wrap({ children, active, role }) {
  const tab = (href, label, isActive) => (
    <Link href={href} style={{ fontSize: 13, fontWeight: 600, textDecoration: "none", padding: "6px 12px",
      borderRadius: 999, color: isActive ? "#fff" : MUTED, background: isActive ? BRAND : "transparent" }}>{label}</Link>
  );
  const isOwnerRole = role === "OWNER" || role === "admin";
  return (
    <main style={{ minHeight: "100vh", background: PAPER }}>
      <header style={{ borderBottom: `1px solid ${LINE}`, background: "rgba(251,246,239,.7)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "0 20px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "Bricolage Grotesque, system-ui", fontWeight: 800, fontSize: 22, color: BRAND }}>SliceMatic</span>
          <nav style={{ display: "flex", gap: 4, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 999, padding: 3 }}>
            {tab("/admin", "Orders", active === "orders")}
            {tab("/admin/menu", "Menu", active === "menu")}
            {isOwnerRole && tab("/admin/analytics", "Analytics", active === "analytics")}
          </nav>
        </div>
      </header>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "22px 20px" }}>{children}</div>
    </main>
  );
}