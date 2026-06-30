// app/api/orders/route.js — create an order (POST) and list orders (GET).
import { createOrder, listOrders } from "@/lib/store";
import { fireWebhook } from "@/lib/webhook";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const order = await createOrder(body);;
    // Fire the "new order" n8n webhook (customer confirmation + staff ticket).
    await fireWebhook(process.env.N8N_WEBHOOK_URL, { event: "new_order", ...order });
    return Response.json({ id: order.id, status: order.status, persisted: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  const orders = await listOrders();

  console.log("IS ARRAY:", Array.isArray(orders));
  console.log("ORDERS:", orders);

  return Response.json({
    success: true,
    count: orders.length,
    first: orders[0],
    orders: orders,
  });
}
