/**
 * midnight-carry-on
 *
 * Runs every day at midnight (0 0 * * *).
 * Items with scheduled_date < today AND state NOT IN ('done', 'someday', 'carry-on', 'focus')
 * are moved to state = 'carry-on' and their scheduled_time is cleared.
 *
 * Every run is logged to automation_runs.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async () => {
  const today = new Date().toISOString().split("T")[0]!;

  // Open a run log entry
  const { data: run, error: runCreateErr } = await supabase
    .from("automation_runs")
    .insert({
      automation: "midnight-carry-on",
      status: "running",
      metadata: { today },
    })
    .select("id")
    .single();

  if (runCreateErr || !run) {
    console.error("Failed to create run log:", runCreateErr?.message);
    return new Response("Failed to create run log", { status: 500 });
  }

  const runId: string = run.id;

  try {
    // Find all items past due that should be carried on
    const { data: items, error: fetchErr } = await supabase
      .from("items")
      .select("id")
      .lt("scheduled_date", today)
      .not("state", "in", '("done","someday","carry-on","focus")')
      .is("deleted_at", null);

    if (fetchErr) throw new Error(fetchErr.message);

    const ids = (items ?? []).map((r: { id: string }) => r.id);

    let affected = 0;

    if (ids.length > 0) {
      const { error: updateErr, count } = await supabase
        .from("items")
        .update({
          state: "carry-on",
          scheduled_time: null,
          updated_at: new Date().toISOString(),
        })
        .in("id", ids);

      if (updateErr) throw new Error(updateErr.message);
      affected = count ?? ids.length;
    }

    // Mark run as success
    await supabase
      .from("automation_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        affected_rows: affected,
        metadata: { today, processed_ids: ids },
      })
      .eq("id", runId);

    console.log(`midnight-carry-on: ${affected} items moved to carry-on`);
    return Response.json({ ok: true, affected });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await supabase
      .from("automation_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", runId);

    console.error("midnight-carry-on failed:", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
