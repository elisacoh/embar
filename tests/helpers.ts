import { createClient } from "@supabase/supabase-js";

/** Service-role client — bypasses RLS. Use only in test setup/teardown. */
export function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Anon client — respects RLS. */
function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Create a confirmed test user via the admin API. */
export async function createTestUser(email: string, password = "Test1234!") {
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createTestUser(${email}): ${error.message}`);
  return data.user!;
}

/** Sign in and return an access token for use as a Bearer token. */
export async function signIn(email: string, password = "Test1234!") {
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`signIn(${email}): ${error?.message}`);
  return data.session.access_token;
}

/** Delete a test user and cascade all their data. */
export async function deleteTestUser(userId: string) {
  await serviceClient().auth.admin.deleteUser(userId);
}

/** Build a Request with the Authorization header pre-set. */
export function authedReq(url: string, token: string, init?: RequestInit): Request {
  return new Request(`http://localhost${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    },
  });
}

/** Convenience: get the auto-created workspace_id for a user. */
export async function getWorkspaceId(userId: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error(`getWorkspaceId(${userId}): ${error?.message}`);
  return data.workspace_id as string;
}
