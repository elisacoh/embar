/**
 * Core CRUD + 401 tests for /api/items and /api/items/:id
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET, POST } from "@/app/api/items/route";
import { PATCH, DELETE } from "@/app/api/items/[id]/route";
import {
  createTestUser,
  signIn,
  deleteTestUser,
  serviceClient,
  authedReq,
  getWorkspaceId,
} from "../helpers";

const EMAIL = `test-items-${Date.now()}@embar.test`;
const PASSWORD = "Test1234!";

let userId: string;
let token: string;
let workspaceId: string;
let itemId: string;

beforeAll(async () => {
  const user = await createTestUser(EMAIL, PASSWORD);
  userId = user.id;
  token = await signIn(EMAIL, PASSWORD);
  workspaceId = await getWorkspaceId(userId);
});

afterAll(async () => {
  await deleteTestUser(userId);
});

// ── POST /api/items ──────────────────────────────────────────────────────────

describe("POST /api/items", () => {
  it("creates item with valid data and returns it with id + assigned_to = creator", async () => {
    const req = authedReq("/api/items", token, {
      method: "POST",
      body: JSON.stringify({ workspace_id: workspaceId, title: "Integration test task" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { item: Record<string, unknown> };
    expect(body.item.id).toBeDefined();
    expect(body.item.title).toBe("Integration test task");
    expect(body.item.assigned_to).toBe(userId);
    expect(body.item.workspace_id).toBe(workspaceId);

    itemId = body.item.id as string;
  });
});

// ── GET /api/items ───────────────────────────────────────────────────────────

describe("GET /api/items", () => {
  it("returns only items for the requested workspace with deleted_at IS NULL", async () => {
    const req = authedReq(`/api/items?workspace_id=${workspaceId}`, token);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((i) => i.workspace_id === workspaceId)).toBe(true);
    expect(body.items.every((i) => i.deleted_at == null)).toBe(true);
  });
});

// ── PATCH /api/items/:id ─────────────────────────────────────────────────────

describe("PATCH /api/items/:id", () => {
  it("state=done sets completed_at and updated_at is refreshed", async () => {
    const before = new Date();

    const req = authedReq(`/api/items/${itemId}`, token, {
      method: "PATCH",
      body: JSON.stringify({ state: "done" }),
    });
    const res = await PATCH(req, { params: { id: itemId } });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: Record<string, unknown> };
    expect(body.item.state).toBe("done");
    expect(body.item.completed_at).toBeTruthy();
    expect(new Date(body.item.updated_at as string).getTime()).toBeGreaterThanOrEqual(
      before.getTime() - 1000 // 1s tolerance for clock skew
    );
  });

  it("scheduled_date is updated and returned correctly, other fields unchanged", async () => {
    const date = "2025-06-15";

    const req = authedReq(`/api/items/${itemId}`, token, {
      method: "PATCH",
      body: JSON.stringify({ scheduled_date: date }),
    });
    const res = await PATCH(req, { params: { id: itemId } });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: Record<string, unknown> };
    expect(body.item.scheduled_date).toBe(date);
    // Response must include the item id and preserve unrelated fields
    expect(body.item.id).toBe(itemId);
    expect(body.item.title).toBe("Integration test task");
    expect(body.item.workspace_id).toBe(workspaceId);
  });
});

// ── DELETE /api/items/:id ────────────────────────────────────────────────────

describe("DELETE /api/items/:id", () => {
  it("sets deleted_at in DB and item does not appear in subsequent GET", async () => {
    const delReq = authedReq(`/api/items/${itemId}`, token, { method: "DELETE" });
    const delRes = await DELETE(delReq, { params: { id: itemId } });

    expect(delRes.status).toBe(200);
    expect(((await delRes.json()) as { ok: boolean }).ok).toBe(true);

    // Verify row has deleted_at set in DB
    const { data } = await serviceClient()
      .from("items")
      .select("deleted_at")
      .eq("id", itemId)
      .single();
    expect(data!.deleted_at).toBeTruthy();

    // Subsequent GET must not return the deleted item
    const getRes = await GET(authedReq(`/api/items?workspace_id=${workspaceId}`, token));
    const getBody = (await getRes.json()) as { items: Record<string, unknown>[] };
    expect(getBody.items.find((i) => i.id === itemId)).toBeUndefined();
  });
});

// ── Unauthenticated → 401 ────────────────────────────────────────────────────

describe("Unauthenticated requests → 401", () => {
  it("GET /api/items without token", async () => {
    const res = await GET(new Request(`http://localhost/api/items?workspace_id=${workspaceId}`));
    expect(res.status).toBe(401);
  });

  it("POST /api/items without token", async () => {
    const res = await POST(
      new Request("http://localhost/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, title: "no auth" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("PATCH /api/items/:id without token", async () => {
    const res = await PATCH(
      new Request(`http://localhost/api/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "done" }),
      }),
      { params: { id: itemId } }
    );
    expect(res.status).toBe(401);
  });

  it("DELETE /api/items/:id without token", async () => {
    const res = await DELETE(
      new Request(`http://localhost/api/items/${itemId}`, { method: "DELETE" }),
      { params: { id: itemId } }
    );
    expect(res.status).toBe(401);
  });
});
