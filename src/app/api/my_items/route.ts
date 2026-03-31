import { createRouteClient, getToken, unauthorized } from "@/lib/supabase/route";

export async function GET(req: Request) {
  const token = getToken(req);
  if (!token) return unauthorized();

  const supabase = createRouteClient(token);
  const { data, error } = await supabase.from("my_items").select("*");

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ items: data ?? [] });
}
