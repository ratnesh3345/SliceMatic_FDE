// lib/webhook.js — fire an n8n webhook with a short timeout. Never throws.
export async function fireWebhook(url, payload) {
  if (!url) return { ok: false, reason: "no webhook url set" };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return { ok: r.ok };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
