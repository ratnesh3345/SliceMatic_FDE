// app/api/vani/lookup/route.js
// Looks up the LATEST order by phone number — no order ID needed.
// Also computes whether cancellation is still possible.
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { phone } = await req.json();
    if (!phone) return Response.json({ found: false });

    const ph = String(phone).replace(/\D/g, "").slice(-10);

    // Get the most recent order for this phone number
    const { data, error } = await supabase
      .from("orders")
      .select("id, name, status, phone, \"createdAt\", \"updatedAt\"")
      .ilike("phone", "%" + ph)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return Response.json({ found: false });

    // Cancellation eligibility:
    // - Can cancel if status is PLACED or ACCEPTED
    // - Cannot cancel if OUT_FOR_DELIVERY or DELIVERED
    // - If DELIVERED, check if it's been more than 2 hours
    const nonCancellable = ["OUT_FOR_DELIVERY", "DELIVERED"];
    let canCancel = !nonCancellable.includes(data.status);
    let deliveredAt = null;
    let hoursSinceDelivery = null;
    let refundEligible = false;

    if (data.status === "DELIVERED") {
      const updatedTime = data["updatedAt"] || data["createdAt"];
      if (updatedTime) {
        deliveredAt = new Date(updatedTime);
        hoursSinceDelivery = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60);
        // Refund/complaint eligible within 2 hours of delivery
        refundEligible = hoursSinceDelivery <= 2;
      }
    }

    return Response.json({
      found: true,
      name: data.name,
      status: data.status,
      orderId: data.id,
      canCancel,
      refundEligible,
      hoursSinceDelivery: hoursSinceDelivery ? +hoursSinceDelivery.toFixed(1) : null,
    });
  } catch (err) {
    console.error("Vani lookup error:", err);
    return Response.json({ found: false });
  }
}