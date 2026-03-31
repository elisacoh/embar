/**
 * Workspace isolation (RLS) tests.
 * Verifies that Supabase RLS silently filters cross-workspace access.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET, POST } from "@/app/api/items/route";
import { PATCH } from "@/app/api/items/[id]/route";
import {
  createTestUser,
  signIn,
  deleteTestUser,
  serviceClient,
  authedReq,
  getWorkspaceId,
} from "../helpers";

const EMAIL_A = `test-rls-a-${Date.now()}@embar.test`;
const EMAIL_B = `test-rls-b-${Date.now()}@embar.test`;
const PASSWORD = "Test1234!";

let userAId: string;
let userBId: string;
let tokenA: string;
let tokenB: string;
let workspaceA: string;
let privateItemId: string; // item owned by A

beforeAll(async () => {
  const [userA, userB] = await Promise.all([
    createTestUser(EMAIL_A, PASSWORD),
    createTestUser(EMAIL_B, PASSWORD),
  ]);
  userAId = userA.id;
  userBId = userB.id;

  [tokenA, tokenB] = await Promise.all([signIn(EMAIL_A, PASSWORD), signIn(EMAIL_B, PASSWORD)]);

  workspaceA = await getWorkspaceId(userAId);

  // Seed an item in workspace A via service role
  const { data } = await serviceClient()
    .from("items")
    .insert({
      workspace_id: workspaceA,
      title: "A's private task",
      assigned_to: userAId,
      created_by: userAId,
    })
    .select("id")
    .single();
  privateItemId = data!.id as string;
});

afterAll(async () => {
  await Promise.all([deleteTestUser(userAId), deleteTestUser(userBId)]);
});

// ── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/items — workspace isolation", () => {
  it("owner of workspace A can read their own items", async () => {
    const res = await GET(authedReq(`/api/items?workspace_id=${workspaceA}`, tokenA));
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    expect(body.items.length).toBeGreaterThan(0);
  });

  it("user NOT a member of workspace A gets 0 results (RLS silently filters, not 401)", async () => {
    const res = await GET(authedReq(`/api/items?workspace_id=${workspaceA}`, tokenB));
    expect(res.status).toBe(200); // not 401 — RLS filters, not rejects
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    expect(body.items.length).toBe(0);
  });

  it("User A's item is invisible to User B", async () => {
    const res = await GET(authedReq(`/api/items?workspace_id=${workspaceA}`, tokenB));
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    expect(body.items.find((i) => i.id === privateItemId)).toBeUndefined();
  });
});

// ── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/items — workspace isolation", () => {
  it("user B posting to workspace A they don't belong to — item is NOT created", async () => {
    const title = `rls-inject-${Date.now()}`;
    await POST(
      authedReq("/api/items", tokenB, {
        method: "POST",
        body: JSON.stringify({ workspace_id: workspaceA, title }),
      })
    );

    // Verify via service role that no such item exists
    const { data } = await serviceClient()
      .from("items")
      .select("id")
      .eq("workspace_id", workspaceA)
      .eq("title", title);
    expect(data?.length ?? 0).toBe(0);
  });
});

// ── PATCH ────────────────────────────────────────────────────────────────────

describe("PATCH /api/items/:id — workspace isolation", () => {
  it("user B patching A's item — 0 rows affected, title unchanged in DB", async () => {
    await PATCH(
      authedReq(`/api/items/${privateItemId}`, tokenB, {
        method: "PATCH",
        body: JSON.stringify({ title: "B tried to overwrite this" }),
      }),
      { params: { id: privateItemId } }
    );

    const { data } = await serviceClient()
      .from("items")
      .select("title")
      .eq("id", privateItemId)
      .single();
    expect(data!.title).toBe("A's private task");
  });
});
