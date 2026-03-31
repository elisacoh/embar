import { createClient } from "@supabase/supabase-js";

/** Create a Supabase client authenticated via a JWT Bearer token. */
export function createRouteClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}

export function getToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
