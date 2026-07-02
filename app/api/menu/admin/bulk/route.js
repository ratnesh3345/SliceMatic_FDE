// app/api/menu/admin/bulk/route.js — CSV bulk import for menu items.
// OWNER only. Upserts by item_code: existing codes get updated,
// new codes get inserted. Rows with missing/invalid data are skipped
// and reported back, never silently dropped.
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = ["base", "pizza", "topping"];

export async function POST(req) {
  try {
    const { rows, role } = await req.json();
    if (!(role === "OWNER" || role === "admin")) {
      return Response.json({ ok: false, message: "Only the owner can bulk-import the menu." }, { status: 403 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return Response.json({ ok: false, message: "No rows to import." }, { status: 400 });
    }

    // Pull existing items to know what's an update vs a new insert,
    // and to preserve sort_order for items already on the menu.
    const { data: existing, error: exErr } = await supabase.from("menu_items").select("id, item_code, sort_order");
    if (exErr) return Response.json({ ok: false, message: exErr.message }, { status: 500 });
    const existingByCode = new Map(existing.map((e) => [e.item_code, e]));

    // Track max sort_order per category so new items land at the end.
    const { data: allItems } = await supabase.from("menu_items").select("category, sort_order");
    const maxSort = {};
    for (const it of allItems || []) maxSort[it.category] = Math.max(maxSort[it.category] || 0, it.sort_order || 0);

    const errors = [];
    const toInsert = [];
    const toUpdate = [];

    rows.forEach((row, i) => {
      const rowNum = i + 2; // +2: header row + 1-index
      const category = String(row.category || "").trim().toLowerCase();
      const item_code = String(row.item_code || "").trim();
      const name = String(row.name || "").trim();
      const price = Number(row.price);
      const is_available = String(row.is_available ?? "true").trim().toLowerCase() !== "false";

      if (!VALID_CATEGORIES.includes(category)) { errors.push(`Row ${rowNum}: invalid category "${row.category}" (must be base, pizza, or topping)`); return; }
      if (!item_code) { errors.push(`Row ${rowNum}: missing item_code`); return; }
      if (!name) { errors.push(`Row ${rowNum}: missing name`); return; }
      if (!price || price <= 0 || isNaN(price)) { errors.push(`Row ${rowNum}: invalid price "${row.price}"`); return; }

      const existingRow = existingByCode.get(item_code);
      if (existingRow) {
        toUpdate.push({ id: existingRow.id, category, name, price, is_available, "updatedAt": new Date().toISOString() });
      } else {
        maxSort[category] = (maxSort[category] || 0) + 1;
        toInsert.push({ category, item_code, name, price, is_available, sort_order: maxSort[category] });
      }
    });

    let insertedCount = 0, updatedCount = 0;

    if (toInsert.length) {
      const { error: insErr, data: insData } = await supabase.from("menu_items").insert(toInsert).select();
      if (insErr) errors.push(`Insert failed: ${insErr.message}`);
      else insertedCount = insData.length;
    }

    for (const u of toUpdate) {
      const { id, ...fields } = u;
      const { error: updErr } = await supabase.from("menu_items").update(fields).eq("id", id);
      if (updErr) errors.push(`Update failed for id ${id}: ${updErr.message}`);
      else updatedCount++;
    }

    return Response.json({
      ok: true,
      inserted: insertedCount,
      updated: updatedCount,
      errorCount: errors.length,
      errors: errors.slice(0, 20), // cap so response doesn't explode on a bad file
    });
  } catch (err) {
    return Response.json({ ok: false, message: String(err) }, { status: 500 });
  }
}