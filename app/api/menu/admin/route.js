// app/api/menu/admin/route.js — staff/owner menu management API.
// GET: list all items (incl. out-of-stock) for the admin panel.
// PATCH: toggle stock or edit price/name — role passed from client session.
// POST: add a new item — OWNER only.
// DELETE: remove an item — OWNER only.
//
// Honest caveat: role is trusted from the request body, same lightweight
// session model as the rest of the admin area (no server-side auth tokens
// yet). Fine for this MVP; production would verify a real session/JWT.
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";

function isOwner(role) { return role === "OWNER" || role === "admin"; }

export async function GET() {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
  return Response.json({ ok: true, items: data });
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, role, is_available, price, name, sort_order } = body;
    if (!id) return Response.json({ ok: false, message: "Missing id" }, { status: 400 });

    const update = { "updatedAt": new Date().toISOString() };

    // Toggling stock and reordering are allowed for STAFF and OWNER — operational, day-to-day.
    if (typeof is_available === "boolean") update.is_available = is_available;
    if (typeof sort_order === "number") update.sort_order = sort_order;

    // Editing price/name is a menu/pricing decision — OWNER only.
    if (price !== undefined || name !== undefined) {
      if (!isOwner(role)) {
        return Response.json({ ok: false, message: "Only the owner can edit price or name." }, { status: 403 });
      }
      if (price !== undefined) update.price = price;
      if (name !== undefined) update.name = name;
    }

    const { data, error } = await supabase
      .from("menu_items")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
    return Response.json({ ok: true, item: data });
  } catch (err) {
    return Response.json({ ok: false, message: String(err) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { role, category, name, price, item_code } = body;
    if (!isOwner(role)) return Response.json({ ok: false, message: "Only the owner can add menu items." }, { status: 403 });
    if (!category || !name || !price || !item_code) {
      return Response.json({ ok: false, message: "category, name, price, item_code are required." }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("menu_items")
      .insert({ category, name, price, item_code, is_available: true, sort_order: 999 })
      .select()
      .single();
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
    return Response.json({ ok: true, item: data });
  } catch (err) {
    return Response.json({ ok: false, message: String(err) }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { id, role } = await req.json();
    if (!isOwner(role)) return Response.json({ ok: false, message: "Only the owner can remove menu items." }, { status: 403 });
    if (!id) return Response.json({ ok: false, message: "Missing id" }, { status: 400 });
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, message: String(err) }, { status: 500 });
  }
}