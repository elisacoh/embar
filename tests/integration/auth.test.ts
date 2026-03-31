/**
 * Signup + workspace defaults tests
 */
import { describe, it, expect, afterAll } from "vitest";
import { POST as signup } from "@/app/api/auth/signup/route";
import { GET as getWorkspaces } from "@/app/api/workspaces/route";
import { deleteTestUser, serviceClient, signIn, authedReq } from "../helpers";

const EMAIL = `test-auth-${Date.now()}@embar.test`;
const PASSWORD = "Test1234!";

let userId: string;
let token: string;
let workspaceId: string;

afterAll(async () => {
  if (userId) await deleteTestUser(userId);
});

// Run in order — later tests depend on the signup result
describe("POST /api/auth/signup", () => {
  it("creates user and returns 201", async () => {
    const res = await signup(
      new Request("http://localhost/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: { id: string } };
    expect(body.user.id).toBeDefined();
    userId = body.user.id;
    token = await signIn(EMAIL, PASSWORD);
  });

  it("auto-created workspace has is_personal=true and is_default=true", async () => {
    const admin = serviceClient();
    const { data: wm } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .single();
    workspaceId = wm!.workspace_id as string;

    const { data: ws } = await admin
      .from("workspaces")
      .select("is_personal, is_default")
      .eq("id", workspaceId)
      .single();

    expect(ws!.is_personal).toBe(true);
    expect(ws!.is_default).toBe(true);
  });

  it("workspace_members row has role='owner'", async () => {
    const { data } = await serviceClient()
      .from("workspace_members")
      .select("role")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .single();
    expect(data!.role).toBe("owner");
  });
});

// ── GET /api/workspaces ──────────────────────────────────────────────────────

describe("GET /api/workspaces", () => {
  it("returns workspaces with default first (is_default=true ordered first)", async () => {
    const res = await getWorkspaces(authedReq("/api/workspaces", token));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { workspaces: Record<string, unknown>[] };
    expect(body.workspaces.length).toBeGreaterThan(0);
    expect(body.workspaces[0]!.is_default).toBe(true);
  });

  it("unauthenticated request → 401", async () => {
    const res = await getWorkspaces(new Request("http://localhost/api/workspaces"));
    expect(res.status).toBe(401);
  });
});
