// app/api/vani/route.js
export const dynamic = "force-dynamic";

const WEBHOOK_URL = process.env.N8N_VANI_ESCALATION_URL;

// Intents that ALWAYS escalate regardless of AI response
const FORCE_ESCALATE_INTENTS = ["CANCELLATION", "REFUND", "REPLACEMENT", "COMPLAINT", "MANAGER_REQUEST"];

function detectIntent(text) {
  const m = text.toLowerCase();
  if (m.includes("cancel")) return "CANCELLATION";
  if (m.includes("refund") || m.includes("money back")) return "REFUND";
  if (m.includes("replac") || m.includes("wrong order") || m.includes("missing")) return "REPLACEMENT";
  if (m.includes("complaint") || m.includes("bad") || m.includes("cold") || m.includes("stale") || m.includes("quality")) return "COMPLAINT";
  if (m.includes("manager") || m.includes("human") || m.includes("person") || m.includes("talk") || m.includes("call")) return "MANAGER_REQUEST";
  if (m.includes("where") || m.includes("status") || m.includes("track")) return "ORDER_STATUS";
  if (m.includes("long") || m.includes("late") || m.includes("wait") || m.includes("eta")) return "ETA";
  return "GENERAL";
}

const SYSTEM = (ctx) => `You are Vani, the friendly support assistant for SliceMatic — a pizza delivery outlet in New Ashok Nagar, East Delhi. Operating hours: 11am–11pm daily.

CUSTOMER CONTEXT (never ask for any of this — you already have it):
- Name: ${ctx.customerName || "unknown"}
- Phone: ${ctx.phone || "unknown"}
- Order ID: #${ctx.orderId || "unknown"}
- Order Status: ${ctx.orderStatus || "unknown"}
- Can Cancel: ${ctx.canCancel ? "YES" : "NO"}
- Refund Eligible (within 2hrs): ${ctx.refundEligible ? "YES" : "NO"}
- Hours Since Delivery: ${ctx.hoursSinceDelivery ? ctx.hoursSinceDelivery + " hours" : "N/A"}

CANCELLATION POLICY:
- PLACED or ACCEPTED → can cancel, tell customer manager will process it
- OUT_FOR_DELIVERY → cannot cancel, rider is on the way
- DELIVERED → cannot cancel, but can raise complaint/refund if within 2 hours

ALWAYS reply with valid JSON only — no markdown, no backticks, no explanation:
{"reply": "your message here", "escalated": true_or_false}

Keep replies under 55 words. Warm and human tone.`;

function ruleBasedReply(userMsg, ctx, intent) {
  if (intent === "CANCELLATION") {
    if (ctx.canCancel) return { reply: "I've flagged your cancellation request for order #" + ctx.orderId + " to the kitchen. A manager will confirm within 5 minutes.", escalated: true };
    if (ctx.orderStatus === "OUT_FOR_DELIVERY") return { reply: "Sorry, the rider is already on the way with order #" + ctx.orderId + " so we can't cancel it now. If there's an issue on delivery, I can help with a replacement!", escalated: false };
    return { reply: "Order #" + ctx.orderId + " has already been delivered. I can raise a complaint or refund request — would you like that?", escalated: false };
  }
  if (intent === "REFUND") {
    if (ctx.refundEligible) return { reply: "You're within our 2-hour refund window for order #" + ctx.orderId + ". I've escalated this to the manager for review.", escalated: true };
    return { reply: "Our refund window is 2 hours from delivery. Your order was delivered " + (ctx.hoursSinceDelivery || "a while") + " hours ago — I'll still raise this with the manager.", escalated: true };
  }
  if (intent === "REPLACEMENT") return { reply: "So sorry about that! I've logged a replacement request for order #" + ctx.orderId + ". The kitchen will call " + ctx.phone + " within 10 minutes.", escalated: true };
  if (intent === "COMPLAINT") return { reply: "I'm really sorry to hear that. I've flagged this to our duty manager — they'll call " + ctx.phone + " within 15 minutes.", escalated: true };
  if (intent === "MANAGER_REQUEST") return { reply: "Connecting you to our duty manager now. They'll call " + ctx.phone + " within 15 minutes. — Vani 🍕", escalated: true };
  if (intent === "ORDER_STATUS") {
    const eta = ctx.orderStatus === "OUT_FOR_DELIVERY" ? "15–20 mins" : ctx.orderStatus === "ACCEPTED" ? "25–35 mins" : "35–45 mins";
    return { reply: "Order #" + ctx.orderId + " is currently **" + (ctx.orderStatus || "placed") + "**. Estimated delivery: " + eta + ".", escalated: false };
  }
  if (intent === "ETA") return { reply: "Average delivery is 30–40 mins from order time. I'll check on yours with the team right now.", escalated: true };
  return { reply: "I've noted your concern and flagged it to our team. Someone will reach out to " + ctx.phone + " shortly.", escalated: true };
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
        can_cancel: ctx.canCancel || false,
        refund_eligible: ctx.refundEligible || false,
        customer_message: conversationSummary,
        vani_reply: vaniReply,
        timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      }),
    });
  } catch (err) {
    console.error("Escalation webhook failed:", err);
  }
}

export async function POST(req) {
  try {
    const { messages, context } = await req.json();
    const ctx = context || {};

    // Detect intent from ALL user messages in conversation
    const allUserText = messages.filter(m => m.role === "user").map(m => m.text).join(" ");
    const intent = detectIntent(allUserText);

    // Full conversation for context in webhook
    const conversationSummary = messages
      .filter(m => m.role === "user")
      .map(m => m.text)
      .join(" → ");

    const apiMessages = messages
      .filter((m, i) => !(i === 0 && m.role === "assistant"))
      .map(m => ({ role: m.role, content: m.text }));

    const apiKey = process.env.OPENROUTER_API_KEY;
    let reply = "", escalated = false;

    if (!apiKey) {
      // Rule-based fallback
      const result = ruleBasedReply(allUserText, ctx, intent);
      reply = result.reply;
      escalated = result.escalated;
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
          escalated = !!parsed.escalated;
        } catch {
          reply = raw;
          escalated = false;
        }
      } catch {
        // AI failed — fall back to rule-based
        const result = ruleBasedReply(allUserText, ctx, intent);
        reply = result.reply;
        escalated = result.escalated;
      }
    }

    // CRITICAL: Force escalate for high-priority intents
    // regardless of what the AI said
    if (FORCE_ESCALATE_INTENTS.includes(intent)) {
      escalated = true;
    }

    // Fire webhook if escalated
    if (escalated) {
      await fireEscalationWebhook(ctx, conversationSummary, reply, intent);
    }

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