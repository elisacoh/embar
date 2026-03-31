import { createRouteClient, getToken, unauthorized } from "@/lib/supabase/route";

export async function GET(req: Request) {
  const token = getToken(req);
  if (!token) return unauthorized();

  const supabase = createRouteClient(token);
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, type, is_default, is_personal, color, created_at")
    .is("deleted_at", null)
    .order("is_default", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ workspaces: data ?? [] });
}
