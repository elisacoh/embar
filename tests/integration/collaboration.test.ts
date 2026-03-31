/**
 * Collaboration tests — shared workspaces + GET /api/my_items
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET as getItems } from "@/app/api/items/route";
import { GET as getMyItems } from "@/app/api/my_items/route";
import {
  createTestUser,
  signIn,
  deleteTestUser,
  serviceClient,
  authedReq,
  getWorkspaceId,
} from "../helpers";

const EMAIL_A = `test-collab-a-${Date.now()}@embar.test`;
const EMAIL_B = `test-collab-b-${Date.now()}@embar.test`;
const EMAIL_C = `test-collab-c-${Date.now()}@embar.test`;
const PASSWORD = "Test1234!";

let userAId: string;
let userBId: string;
let userCId: string;
let tokenA: string;
let tokenB: string;
let sharedWorkspaceId: string;
let workspaceC: string; // private — only C is a member

beforeAll(async () => {
  const [userA, userB, userC] = await Promise.all([
    createTestUser(EMAIL_A, PASSWORD),
    createTestUser(EMAIL_B, PASSWORD),
    createTestUser(EMAIL_C, PASSWORD),
  ]);
  userAId = userA.id;
  userBId = userB.id;
  userCId = userC.id;

  const tokens = await Promise.all([
    signIn(EMAIL_A, PASSWORD),
    signIn(EMAIL_B, PASSWORD),
    signIn(EMAIL_C, PASSWORD),
  ]);
  tokenA = tokens[0];
  tokenB = tokens[1];

  workspaceC = await getWorkspaceId(userCId);

  const admin = serviceClient();

  // Create a shared workspace and add both A and B
  const { data: ws } = await admin
    .from("workspaces")
    .insert({ name: "Shared Workspace", type: "professional", owner_id: userAId })
    .select("id")
    .single();
  sharedWorkspaceId = ws!.id as string;

  await admin.from("workspace_members").insert([
    { workspace_id: sharedWorkspaceId, user_id: userAId, role: "owner" },
    { workspace_id: sharedWorkspaceId, user_id: userBId, role: "member" },
  ]);

  // Seed items
  await admin.from("items").insert([
    {
      workspace_id: sharedWorkspaceId,
      title: "Shared task from A",
      created_by: userAId,
      assigned_to: userAId,
    },
    {
      workspace_id: workspaceC,
      title: "C's private task",
      created_by: userCId,
      assigned_to: userCId,
    },
  ]);
});

afterAll(async () => {
  await Promise.all([deleteTestUser(userAId), deleteTestUser(userBId), deleteTestUser(userCId)]);
});

// ── Collaboration ────────────────────────────────────────────────────────────

describe("Collaboration", () => {
  it("User A creates item → User B (same workspace member) can read it", async () => {
    const res = await getItems(authedReq(`/api/items?workspace_id=${sharedWorkspaceId}`, tokenB));
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    expect(body.items.some((i) => i.title === "Shared task from A")).toBe(true);
  });
});

// ── GET /api/my_items ────────────────────────────────────────────────────────

describe("GET /api/my_items", () => {
  it("returns items assigned_to or created_by current user across all their workspaces", async () => {
    const res = await getMyItems(authedReq("/api/my_items", tokenA));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    expect(body.items.some((i) => i.title === "Shared task from A")).toBe(true);
  });

  it("does NOT return items from workspaces user is not a member of", async () => {
    // User A is not a member of workspace C
    const res = await getMyItems(authedReq("/api/my_items", tokenA));
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    expect(body.items.every((i) => i.workspace_id !== workspaceC)).toBe(true);
  });

  it("unauthenticated request → 401", async () => {
    const res = await getMyItems(new Request("http://localhost/api/my_items"));
    expect(res.status).toBe(401);
  });
});
