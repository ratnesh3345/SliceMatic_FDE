// // lib/store.js — dead-simple file-based order store (server-side only).
// // Persists to data/orders.json. No external database or account required.
// // The data layer is isolated here, so you can later swap this for Supabase
// // without touching the UI or API routes.
// import fs from "fs";
// import path from "path";

// const DATA_DIR = path.join(process.cwd(), "data");
// const FILE = path.join(DATA_DIR, "orders.json");

// function ensure() {
//   if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
//   if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ seq: 0, orders: [] }, null, 2));
// }
// function read() {
//   ensure();
//   try { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
//   catch { return { seq: 0, orders: [] }; }
// }
// function write(db) { ensure(); fs.writeFileSync(FILE, JSON.stringify(db, null, 2)); }

// export const STATUSES = ["PLACED", "ACCEPTED", "OUT_FOR_DELIVERY", "DELIVERED"];

// export function createOrder(o) {
//   const db = read();
//   db.seq += 1;
//   const order = { id: db.seq, createdAt: new Date().toISOString(), status: "PLACED", ...o };
//   db.orders.push(order);
//   write(db);
//   return order;
// }
// export function listOrders() { return read().orders.slice().reverse(); } // newest first
// export function getOrder(id) { return read().orders.find((o) => o.id === Number(id)) || null; }
// export function getOrdersByPhone(phone) { return read().orders.filter((o) => o.phone === phone); }
// export function updateStatus(id, status) {
//   if (!STATUSES.includes(status)) return null;
//   const db = read();
//   const o = db.orders.find((x) => x.id === Number(id));
//   if (!o) return null;
//   o.status = status;
//   o.updatedAt = new Date().toISOString();
//   write(db);
//   return o;
// }

import { supabase } from "./supabase";

export const STATUSES = [
  "PLACED",
  "ACCEPTED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export async function createOrder(orderData) {
  const order = {
    createdAt: new Date().toISOString(),
    status: "PLACED",
    ...orderData,
  };

  const { data, error } = await supabase
    .from("orders")
    .insert(order)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function listOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("id", { ascending: false });

  console.log("SUPABASE DATA:", data);
  console.log("SUPABASE ERROR:", error);
  console.log("ID TYPE:", typeof data[0]?.id);
console.log("ID VALUE:", data[0]?.id);

  if (error) throw error;

  return data;
}

export async function getOrder(id) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", Number(id))
    .single();

  if (error) return null;

  return data;
}

export async function getOrdersByPhone(phone) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("phone", phone)
    .order("id", { ascending: false });

  if (error) throw error;

  return data;
}

export async function updateStatus(id, status) {
  if (!STATUSES.includes(status)) return null;

  const { data, error } = await supabase
    .from("orders")
    .update({
      status,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", Number(id))
    .select()
    .single();

  if (error) return null;

  return data;
}
