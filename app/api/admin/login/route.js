// app/api/admin/login/route.js — minimal password gate (no external auth).
export const dynamic = "force-dynamic";
export async function POST(req) {
  try {
    const { password } = await req.json();
    const ok = !!password && password === (process.env.ADMIN_PASSWORD || "slicematic123");
    return Response.json({ ok });
  } catch {
    return Response.json({ ok: false }, { status: 200 });
  }
}
