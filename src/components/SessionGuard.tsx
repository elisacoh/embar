"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Enforces "remember me = false" behaviour.
 * sessionStorage is cleared when the browser closes, so on a fresh browser
 * session we sign the user out if they had opted not to be remembered.
 */
export function SessionGuard() {
  const router = useRouter();

  useEffect(() => {
    const noRemember = localStorage.getItem("embar_remember_me") === "false";
    const sessionActive = sessionStorage.getItem("embar_session_active") === "1";

    if (noRemember && !sessionActive) {
      const supabase = createClient();
      supabase.auth.signOut().then(() => {
        router.push("/login");
      });
    }
  }, [router]);

  return null;
}
