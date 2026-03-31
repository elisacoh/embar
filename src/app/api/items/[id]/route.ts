import { createRouteClient, getToken, unauthorized } from "@/lib/supabase/route";
import { normalizeItem } from "@/lib/normalize";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = getToken(req);
  if (!token) return unauthorized();

  const { id } = params;
  const body = (await req.json()) as Record<string, unknown>;

  const updates: Record<string, unknown> = { ...body };
  if (updates.state === "done") {
    updates.completed_at ??= new Date().toISOString();
  } else if (updates.state !== undefined) {
    updates.completed_at = null;
  }

  const supabase = createRouteClient(token);
  const { data, error } = await supabase
    .from("items")
    .update(updates)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ item: normalizeItem(data as Record<string, unknown>) });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const token = getToken(req);
  if (!token) return unauthorized();

  const { id } = params;
  const supabase = createRouteClient(token);

  const { error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
