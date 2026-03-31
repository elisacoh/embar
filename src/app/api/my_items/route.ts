import { createRouteClient, getToken, unauthorized } from "@/lib/supabase/route";
import { normalizeItem } from "@/lib/normalize";

export async function GET(req: Request) {
  const token = getToken(req);
  if (!token) return unauthorized();

  const supabase = createRouteClient(token);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  // RLS scopes to workspaces the user belongs to; filter to items they own or created
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .is("deleted_at", null)
    .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({
    items: (data ?? []).map((r) => normalizeItem(r as Record<string, unknown>)),
  });
}
