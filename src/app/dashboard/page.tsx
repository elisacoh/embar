import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/LogoutButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Safety net: if the DB trigger missed for any reason, create the workspace now.
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name")
    .is("deleted_at", null)
    .limit(1);

  if (!workspaces || workspaces.length === 0) {
    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: workspace } = await admin
      .from("workspaces")
      .insert({ name: "My Workspace", type: "personal", owner_id: user.id })
      .select("id")
      .single();
    if (workspace) {
      await admin.from("workspace_members").insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: "owner",
      });
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Embar</h1>
          <LogoutButton />
        </div>
        <div className="space-y-2 rounded-lg border border-border p-6">
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <p className="font-medium">{user.email}</p>
        </div>
        <p className="text-sm text-muted-foreground">Sprint 1 — shell coming next.</p>
      </div>
    </div>
  );
}
