// app/api/recommend/route.js — AI recommendation (Option A), reads order history from the file store.
import { getOrdersByPhone } from "@/lib/store";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are SliceMatic's friendly in-app pizza concierge for an outlet in New Ashok Nagar, Delhi.
Recommend exactly ONE combination of crust + pizza + one topping from the menu, in ONE warm sentence (max 30 words).
If the customer has order history, build on what they liked before. If they are new, suggest a crowd-pleaser.
Never invent items that are not on the menu. Do not mention prices. Output only the sentence, no preamble.`;

export async function POST(req) {
  try {
    const { phone, name } = await req.json();
    const history = phone? (await getOrdersByPhone(phone)).slice(-5).reverse(): [];

    const key = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct";

    if (!key) {
      const text = history.length
        ? "Welcome back! Try a Cheese Burst BBQ Chicken with Extra Cheese — a regular favourite."
        : "First time? Go for a Thick Crust Farm House with Caramelised Onions — our most-loved combo.";
      return Response.json({ recommendation: text, model: "fallback (no OpenRouter key)" });
    }

    const historyText = history.length
      ? "Past orders: " + history.map((o) => o.itemsSummary || "").filter(Boolean).join("; ")
      : "No past orders (new customer).";

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Customer ${name || "guest"}. ${historyText} Give one recommendation.` },
        ],
        max_tokens: 80, temperature: 0.7,
      }),
    });
    if (!resp.ok) return Response.json({ recommendation: "Try a Thick Crust Farm House with Caramelised Onions — a house favourite.", model: "fallback" });
    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content?.trim() || "";
    return Response.json({ recommendation: text, model });
  } catch {
    return Response.json({ recommendation: "", model: "" }, { status: 200 });
  }
}
