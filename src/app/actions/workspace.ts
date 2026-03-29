"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceData } from "@/lib/types";

// Uses service role to bypass RLS — workspace creation is a privileged setup
// operation that runs before the user has any workspace membership.
function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function createDefaultWorkspace(
  userId: string
): Promise<{ workspaceId: string } | { error: string }> {
  const supabase = serviceClient();

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({ name: "My Workspace", type: "personal", owner_id: userId })
    .select("id")
    .single();

  if (error || !workspace) {
    return { error: error?.message ?? "Failed to create workspace" };
  }

  const { error: memberError } = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) {
    return { error: memberError.message };
  }

  return { workspaceId: workspace.id };
}

export async function createWorkspace(
  name: string,
  type: WorkspaceData["type"]
): Promise<{ workspace: WorkspaceData } | { error: string }> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const admin = serviceClient();

  const { data: workspace, error } = await admin
    .from("workspaces")
    .insert({ name, type, owner_id: user.id })
    .select("id, name, type")
    .single();

  if (error || !workspace) {
    return { error: error?.message ?? "Failed to create workspace" };
  }

  const { error: memberError } = await admin.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberError) {
    return { error: memberError.message };
  }

  return { workspace: workspace as WorkspaceData };
}

export async function setLastWorkspace(workspaceId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.updateUser({ data: { last_workspace_id: workspaceId } });
}
