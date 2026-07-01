import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {

    const body = await req.json();

    const { error } = await supabase
      .from("customer_events")
      .insert([body]);

    if (error) {
      console.error(error);

      return Response.json({
        ok: false,
        message: error.message,
      });
    }

    return Response.json({
      ok: true,
    });

  } catch (err) {

    console.error(err);

    return Response.json({
      ok: false,
      message: "Failed to save event.",
    });

  }
}