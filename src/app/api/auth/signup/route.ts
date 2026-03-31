import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; password?: string };
  const { email, password } = body;

  if (!email || !password) {
    return Response.json({ error: "email and password required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ user: data.user, session: data.session }, { status: 201 });
}
