import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import type { WorkspaceData } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch all workspaces the user is a member of
  let { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, type, is_default, is_personal")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  // Safety net: create default workspace if none exist
  if (!workspaces || workspaces.length === 0) {
    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: created } = await admin
      .from("workspaces")
      .insert({
        name: "My Workspace",
        type: "personal",
        owner_id: user.id,
        is_default: true,
        is_personal: true,
      })
      .select("id, name, type, is_default, is_personal")
      .single();
    if (created) {
      await admin.from("workspace_members").insert({
        workspace_id: created.id,
        user_id: user.id,
        role: "owner",
      });
      workspaces = [created];
    }
  }

  const allWorkspaces: WorkspaceData[] = (workspaces ?? []) as WorkspaceData[];

  // Determine active workspace: last used (from user metadata) or first
  const lastId = user.user_metadata?.last_workspace_id as string | undefined;
  const initialActiveWorkspaceId =
    (lastId && allWorkspaces.some((w) => w.id === lastId) ? lastId : allWorkspaces[0]?.id) ?? "";

  return (
    <AppShell
      userEmail={user.email ?? ""}
      workspaces={allWorkspaces}
      initialActiveWorkspaceId={initialActiveWorkspaceId}
    />
  );
}
