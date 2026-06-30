// app/api/orders/status/route.js — update an order's status.
import { updateStatus } from "@/lib/store";
import { fireWebhook } from "@/lib/webhook";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { id, status } = await req.json();
    const order = await updateStatus(id, status);

console.log("UPDATED ORDER:", order);
    if (!order) return Response.json({ ok: false, error: "order not found / bad status" }, { status: 404 });

    // When the order goes out for delivery, ping the customer via n8n.
    if (status === "OUT_FOR_DELIVERY") {
      await fireWebhook(process.env.N8N_DELIVERY_WEBHOOK_URL, {
        event: "out_for_delivery",
        orderId: order.id, name: order.name, phone: order.phone,
        address: order.address, total: order.total, itemsSummary: order.itemsSummary,
      });
    }
    return Response.json({ ok: true, order });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
