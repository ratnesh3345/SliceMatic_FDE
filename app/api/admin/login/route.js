import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export async function POST(req) {
  try {
    const { username, password } = await req.json();
    console.log("LOGIN REQUEST:", { username, password });

    if (!username || !password) {
      return Response.json({
        ok: false,
        message: "Username and password are required.",
      });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, password, role")
      .eq("username", username)
      .single();
    console.log("USER:", user);
console.log("ERROR:", error);

    if (error || !user) {
      return Response.json({
        ok: false,
        message: "Invalid username.",
      });
    }

    if (user.password !== password) {
      return Response.json({
        ok: false,
        message: "Invalid password.",
      });
    }

    return Response.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });

  } catch (err) {
    console.error(err);

    return Response.json({
      ok: false,
      message: "Login failed.",
    });
  }
}