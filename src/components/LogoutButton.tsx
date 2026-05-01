"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface TimerState {
  itemId: string;
  elapsed: number;
  startedAt: number | null;
}

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();

    // Flush any running focus timer to the DB before the session is invalidated
    try {
      const raw = localStorage.getItem("embar:focus-timer");
      if (raw) {
        const t = JSON.parse(raw) as TimerState;
        const ms = t.elapsed + (t.startedAt ? Date.now() - t.startedAt : 0);
        if (ms > 0) {
          const { data } = await supabase
            .from("items")
            .select("time_spent_ms")
            .eq("id", t.itemId)
            .single();
          const current = (data?.time_spent_ms as number | null) ?? 0;
          await supabase
            .from("items")
            .update({ time_spent_ms: current + ms })
            .eq("id", t.itemId);
        }
        localStorage.removeItem("embar:focus-timer");
      }
    } catch {
      /* best-effort — don't block sign-out */
    }

    await supabase.auth.signOut();
    localStorage.removeItem("embar_remember_me");
    sessionStorage.removeItem("embar_session_active");
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout}>
      Sign out
    </Button>
  );
}
