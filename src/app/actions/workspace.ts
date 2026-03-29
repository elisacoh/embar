"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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
