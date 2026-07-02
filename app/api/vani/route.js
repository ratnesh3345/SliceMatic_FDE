// app/api/vani/route.js
export const dynamic = "force-dynamic";

const WEBHOOK_URL = process.env.N8N_VANI_ESCALATION_URL;

// Intents that trigger the manager webhook — this is the ONLY source of
// truth for escalation. We never trust the AI's self-reported "escalated"
// flag, because free-tier models over-claim it inconsistently.
const FORCE_ESCALATE_INTENTS = ["CANCELLATION", "REFUND", "REPLACEMENT", "COMPLAINT", "MANAGER_REQUEST"];

function detectIntent(text) {
  const m = text.toLowerCase();
  if (m.includes("cancel")) return "CANCELLATION";
  if (m.includes("refund") || m.includes("money back")) return "REFUND";
  if (m.includes("replac") || m.includes("wrong order") || m.includes("missing")) return "REPLACEMENT";
  if (m.includes("complaint") || m.includes("bad") || m.includes("cold") || m.includes("stale") || m.includes("quality")) return "COMPLAINT";
  if (m.includes("manager") || m.includes("human") || m.includes("person") || m.includes("talk to") || m.includes("call me")) return "MANAGER_REQUEST";
  if (m.includes("where") || m.includes("status") || m.includes("track")) return "ORDER_STATUS";
  if (m.includes("long") || m.includes("late") || m.includes("wait") || m.includes("eta")) return "ETA";
  // Someone trying to place a NEW order through chat — redirect, don't escalate, don't role-play a sale.
  if (m.includes("order") && (m.includes("want") || m.includes("like") || m.includes("get me") || m.includes("crust") || m.includes("topping") || m.includes("pizza") || m.includes("drink"))) return "ORDER_ATTEMPT";
  return "GENERAL";
}

const SYSTEM = (ctx) => `You are Vani, the SliceMatic support assistant for a pizza delivery outlet in New Ashok Nagar, East Delhi. Hours: 11am–11pm daily.

WHAT YOU ARE: a support agent for EXISTING orders only. You help with order status, cancellations, replacements, complaints, and refunds.

WHAT YOU ARE NEVER ALLOWED TO DO — these are hard rules, not suggestions:
- NEVER take a new order, list menu items, or discuss crusts/toppings/drinks as if placing an order. SliceMatic does not sell drinks (no Coke/Pepsi/Water) — do not invent items that aren't real.
- NEVER quote a price, delivery fee, or payment amount. You do not know these numbers. If asked, say "I can't process payments here — that happens on our website checkout."
- NEVER claim an order's status changed, was placed, or is "out for delivery" unless that is EXACTLY the order_status given to you below. You cannot create, confirm, or move orders.
- NEVER invent an order number. Only ever use the order ID given to you below.
- If someone tries to order through chat, respond warmly but redirect them: tell them to use the SliceMatic website's ordering page, and that you're only here to help with an existing order.

CUSTOMER CONTEXT (already known — never ask for any of this):
- Name: ${ctx.customerName || "unknown"}
- Phone: ${ctx.phone || "unknown"}
- Order ID: #${ctx.orderId || "unknown"}
- Order Status: ${ctx.orderStatus || "unknown"}
- Can Cancel: ${ctx.canCancel ? "YES" : "NO"}
- Refund Eligible (within 2hrs of delivery): ${ctx.refundEligible ? "YES" : "NO"}

STATUS MEANINGS: PLACED = kitchen received it (35-45 min ETA). ACCEPTED = being prepared (25-35 min). OUT_FOR_DELIVERY = rider is on the way (15-20 min). DELIVERED = complete.

CANCELLATION POLICY: PLACED/ACCEPTED = cancellable. OUT_FOR_DELIVERY/DELIVERED = not cancellable.
REFUND POLICY: only within 2 hours of delivery.

RESPONSE FORMAT — valid JSON only, no markdown, no backticks:
{"reply": "your message", "escalated": false}

Keep replies under 50 words, warm and human, one emoji max. Never make up facts not given to you above.`;

function ruleBasedReply(userMsg, ctx, intent) {
  if (intent === "ORDER_ATTEMPT") return { reply: "I can't take new orders through chat — head to our website's ordering page for that! I'm only here to help with your existing order #" + (ctx.orderId || "") + ".", escalated: false };
  if (intent === "CANCELLATION") {
    if (ctx.canCancel) return { reply: "I've flagged your cancellation request for order #" + ctx.orderId + " to the kitchen. A manager will confirm within 5 minutes.", escalated: true };
    if (ctx.orderStatus === "OUT_FOR_DELIVERY") return { reply: "Sorry, the rider is already on the way with order #" + ctx.orderId + " so we can't cancel it now.", escalated: false };
    return { reply: "Order #" + ctx.orderId + " has already been delivered. I can raise a complaint or refund request instead — want that?", escalated: false };
  }
  if (intent === "REFUND") {
    if (ctx.refundEligible) return { reply: "You're within our 2-hour refund window. I've escalated order #" + ctx.orderId + " to the manager for review.", escalated: true };
    return { reply: "Our refund window is 2 hours from delivery. I'll still escalate this to the manager.", escalated: true };
  }
  if (intent === "REPLACEMENT") return { reply: "So sorry! I've flagged a replacement request for order #" + ctx.orderId + ". The kitchen will call " + ctx.phone + " within 10 minutes.", escalated: true };
  if (intent === "COMPLAINT") return { reply: "Really sorry to hear that. I've flagged this to our duty manager — they'll call " + ctx.phone + " within 15 minutes.", escalated: true };
  if (intent === "MANAGER_REQUEST") return { reply: "Connecting you to our duty manager now. They'll call " + ctx.phone + " within 15 minutes. — Vani 🍕", escalated: true };
  if (intent === "ORDER_STATUS") {
    const eta = ctx.orderStatus === "OUT_FOR_DELIVERY" ? "15–20 mins" : ctx.orderStatus === "ACCEPTED" ? "25–35 mins" : "35–45 mins";
    return { reply: "Order #" + ctx.orderId + " is currently **" + (ctx.orderStatus || "placed") + "**. Estimated: " + eta + ".", escalated: false };
  }
  if (intent === "ETA") return { reply: "Average delivery is 30–40 mins. I'll check on yours with the team right now.", escalated: true };
  return { reply: "I've noted your message. Is there something specific about your order I can help with — status, a replacement, or a complaint?", escalated: false };
}

async function fireEscalationWebhook(ctx, conversationSummary, vaniReply, intent) {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "VANI_ESCALATION",
        intent,
        customer_name: ctx.customerName || "Unknown",
        phone: ctx.phone || "Unknown",
        order_id: ctx.orderId || "Unknown",
        order_status: ctx.orderStatus || "Unknown",
        customer_message: conversationSummary,
        vani_reply: vaniReply,
        timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      }),
    });
  } catch (err) { console.error("Escalation webhook failed:", err); }
}

export async function POST(req) {
  try {
    const { messages, context } = await req.json();
    const ctx = context || {};

    const allUserText = messages.filter(m => m.role === "user").map(m => m.text).join(" ");
    const lastUserMsg = messages.filter(m => m.role === "user").pop()?.text || "";
    const intent = detectIntent(lastUserMsg); // detect off the LATEST message, not history — avoids re-triggering old intents forever
    const conversationSummary = messages.filter(m => m.role === "user").map(m => m.text).join(" → ");

    const apiMessages = messages
      .filter((m, i) => !(i === 0 && m.role === "assistant"))
      .map(m => ({ role: m.role, content: m.text }));

    const apiKey = process.env.OPENROUTER_API_KEY;
    let reply = "";

    // ORDER_ATTEMPT is always handled by the rule-based redirect —
    // never let the AI freelance a fake order here, regardless of key presence.
    if (intent === "ORDER_ATTEMPT" || !apiKey) {
      const result = ruleBasedReply(allUserText, ctx, intent);
      reply = result.reply;
    } else {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
            messages: [
              { role: "system", content: SYSTEM(ctx) },
              ...(apiMessages.length ? apiMessages : [{ role: "user", content: "Hello" }]),
            ],
            max_tokens: 200,
          }),
        });
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content || "";
        try {
          const clean = raw.replace(/```json|```/g, "").trim();
          const parsed = JSON.parse(clean);
          reply = parsed.reply || raw;
        } catch { reply = raw; }
      } catch {
        const result = ruleBasedReply(allUserText, ctx, intent);
        reply = result.reply;
      }
    }

    // Escalation is decided ONLY by detected intent — never by the AI's own
    // "escalated" field. This is what stops every message from pinging the manager.
    const escalated = FORCE_ESCALATE_INTENTS.includes(intent);

    if (escalated) await fireEscalationWebhook(ctx, conversationSummary, reply, intent);

    console.log(`[Vani] intent=${intent} escalated=${escalated}`);
    return Response.json({ reply, escalated });

  } catch (err) {
    console.error("Vani API error:", err);
    return Response.json({
      reply: "Our duty manager has been notified and will call you shortly. — Vani 🍕",
      escalated: true,
    });
  }
}