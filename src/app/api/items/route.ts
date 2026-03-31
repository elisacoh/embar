import { createRouteClient, getToken, unauthorized } from "@/lib/supabase/route";
import { normalizeItem } from "@/lib/normalize";

export async function GET(req: Request) {
  const token = getToken(req);
  if (!token) return unauthorized();

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspace_id");
  if (!workspaceId) {
    return Response.json({ error: "workspace_id required" }, { status: 400 });
  }

  const supabase = createRouteClient(token);
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({
    items: (data ?? []).map((r) => normalizeItem(r as Record<string, unknown>)),
  });
}

export async function POST(req: Request) {
  const token = getToken(req);
  if (!token) return unauthorized();

  const supabase = createRouteClient(token);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const body = (await req.json()) as Record<string, unknown>;
  const { workspace_id, title, ...rest } = body;

  if (!workspace_id || !title) {
    return Response.json({ error: "workspace_id and title required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("items")
    .insert({
      workspace_id,
      title: (title as string).trim(),
      assigned_to: user.id,
      created_by: user.id,
      state: (rest.state as string | undefined) ?? "unplanned",
      urgency: (rest.urgency as string | undefined) ?? "normal",
      entity_id: rest.entity_id ?? null,
      description: rest.description ?? null,
      subtasks: rest.subtasks ?? [],
      scheduled_date: rest.scheduled_date ?? null,
      scheduled_time: rest.scheduled_time ?? null,
      duration_estimate: rest.duration_estimate ?? null,
      is_fixed: rest.is_fixed ?? false,
      due_date: rest.due_date ?? null,
      hard_deadline: rest.hard_deadline ?? false,
      work_type: rest.work_type ?? null,
      metadata: rest.metadata ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return Response.json({ error: error?.message ?? "Failed to create item" }, { status: 500 });
  }
  return Response.json({ item: normalizeItem(data as Record<string, unknown>) }, { status: 201 });
}
