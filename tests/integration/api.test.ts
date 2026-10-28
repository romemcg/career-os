import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { GET as listFactsRoute, POST as createFactRoute } from "@/app/api/v1/career-facts/route";
import { GET as getFactRoute, PATCH as patchFactRoute } from "@/app/api/v1/career-facts/[id]/route";
import { GET as getProfileRoute } from "@/app/api/v1/profile/route";
import { disconnectDb, getDb } from "@/lib/db/client";
import { PASSWORD, employment, makeOwner, resetDatabase } from "./helpers";

const BASE = "http://127.0.0.1:3001";
const noParams = { params: Promise.resolve({}) };

function request(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { host: "127.0.0.1:3001", origin: BASE, ...init.headers };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.cookie) headers.cookie = init.cookie;
  return new NextRequest(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function signIn(email: string) {
  const response = await login(
    request("/api/v1/auth/login", { method: "POST", body: { email, password: PASSWORD } }),
    noParams,
  );
  const setCookie = response.headers.get("set-cookie") ?? "";
  return { response, setCookie, cookie: setCookie.split(";")[0] };
}

beforeEach(resetDatabase);
afterAll(disconnectDb);

describe("API contract", () => {
  it("rejects unauthenticated requests with the error envelope", async () => {
    const response = await getProfileRoute(request("/api/v1/profile"), noParams);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("sets a hardened session cookie on login", async () => {
    const owner = await makeOwner();
    const { response, setCookie } = await signIn(owner.email);
    expect(response.status).toBe(200);
    expect(setCookie).toMatch(/careeros_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=strict/i);
    expect(setCookie).toMatch(/Path=\//);
  });

  it("marks the cookie Secure over HTTPS", async () => {
    const owner = await makeOwner();
    const response = await login(
      request("/api/v1/auth/login", {
        method: "POST",
        body: { email: owner.email, password: PASSWORD },
        headers: { "x-forwarded-proto": "https" },
      }),
      noParams,
    );
    expect(response.headers.get("set-cookie")).toMatch(/Secure/);
  });

  it("rejects cross-origin mutations even with a valid session", async () => {
    const owner = await makeOwner();
    const { cookie } = await signIn(owner.email);
    const response = await createFactRoute(
      request("/api/v1/career-facts", {
        method: "POST",
        cookie,
        body: { factType: "skill", content: { name: "SQL" } },
        headers: { origin: "https://evil.example" },
      }),
      noParams,
    );
    expect(response.status).toBe(403);
    expect(await getDb().careerFact.count()).toBe(0);
  });

  it("creates, reads, verifies-fails and lists facts with the data envelope", async () => {
    const owner = await makeOwner();
    const { cookie } = await signIn(owner.email);

    const created = await createFactRoute(
      request("/api/v1/career-facts", {
        method: "POST",
        cookie,
        body: { factType: "employment", content: employment },
      }),
      noParams,
    );
    expect(created.status).toBe(201);
    const { data, meta } = await created.json();
    expect(meta.requestId).toBeTruthy();
    expect(data.verificationStatus).toBe("unverified");

    const params = { params: Promise.resolve({ id: data.id }) };
    const fetched = await getFactRoute(request(`/api/v1/career-facts/${data.id}`, { cookie }), params);
    expect(fetched.status).toBe(200);

    const verify = await patchFactRoute(
      request(`/api/v1/career-facts/${data.id}`, { method: "PATCH", cookie, body: { action: "verify", revision: 1 } }),
      params,
    );
    expect(verify.status).toBe(422);
    expect((await verify.json()).error.code).toBe("INVALID_TRANSITION");

    const stale = await patchFactRoute(
      request(`/api/v1/career-facts/${data.id}`, {
        method: "PATCH",
        cookie,
        body: { action: "reject", revision: 9, reason: "x" },
      }),
      params,
    );
    expect(stale.status).toBe(409);

    const list = await listFactsRoute(request("/api/v1/career-facts?limit=500", { cookie }), noParams);
    expect(list.status).toBe(400);
    const list2 = await listFactsRoute(request("/api/v1/career-facts?limit=10", { cookie }), noParams);
    const listed = await list2.json();
    expect(listed.data).toHaveLength(1);
    expect(listed.meta.nextCursor).toBeNull();
  });

  it("returns 404 for malformed and foreign IDs", async () => {
    const owner = await makeOwner();
    const { cookie } = await signIn(owner.email);
    const bad = await getFactRoute(request("/api/v1/career-facts/abc", { cookie }), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(bad.status).toBe(400);
    const id = "00000000-0000-4000-8000-000000000000";
    const missing = await getFactRoute(request(`/api/v1/career-facts/${id}`, { cookie }), {
      params: Promise.resolve({ id }),
    });
    expect(missing.status).toBe(404);
  });

  it("replays create requests that reuse an Idempotency-Key", async () => {
    const owner = await makeOwner();
    const { cookie } = await signIn(owner.email);
    const body = { factType: "skill", content: { name: "Stakeholder management" } };
    const headers = { "idempotency-key": "create-skill-0001" };
    const first = await createFactRoute(
      request("/api/v1/career-facts", { method: "POST", cookie, body, headers }),
      noParams,
    );
    const second = await createFactRoute(
      request("/api/v1/career-facts", { method: "POST", cookie, body, headers }),
      noParams,
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect((await second.json()).meta.replayed).toBe(true);
    expect(await getDb().careerFact.count()).toBe(1);

    const conflicting = await createFactRoute(
      request("/api/v1/career-facts", {
        method: "POST",
        cookie,
        body: { ...body, content: { name: "Other" } },
        headers,
      }),
      noParams,
    );
    expect(conflicting.status).toBe(422);
  });

  it("rejects non-JSON bodies", async () => {
    const owner = await makeOwner();
    const { cookie } = await signIn(owner.email);
    const response = await createFactRoute(
      new NextRequest(`${BASE}/api/v1/career-facts`, {
        method: "POST",
        headers: { host: "127.0.0.1:3001", origin: BASE, cookie, "content-type": "text/plain" },
        body: "hello",
      }),
      noParams,
    );
    expect(response.status).toBe(415);
  });
});
