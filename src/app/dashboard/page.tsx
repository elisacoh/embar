import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch workspace — create one if missing (safety net if DB trigger failed)
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name")
    .is("deleted_at", null)
    .limit(1);

  let workspaceName = "My Workspace";

  if (!workspaces || workspaces.length === 0) {
    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: workspace } = await admin
      .from("workspaces")
      .insert({ name: "My Workspace", type: "personal", owner_id: user.id })
      .select("id, name")
      .single();
    if (workspace) {
      await admin.from("workspace_members").insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: "owner",
      });
      workspaceName = workspace.name;
    }
  } else {
    workspaceName = workspaces[0]?.name ?? "My Workspace";
  }

  return <AppShell userEmail={user.email ?? ""} workspaceName={workspaceName} />;
}
