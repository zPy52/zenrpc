import { describe, expect, expectTypeOf, test } from "vitest";
import { z } from "zod";

import n, { createClient } from "../src/index";

const server = n.createServer({
  health: n.endpoint({
    handler: async () => ({ ok: true as const })
  }),
  tasks: n.createServer({
    add: n.endpoint({ text: z.string() }, async ({ text }) => ({ ok: true as const, text })),
    get: n.endpoint(
      { taskListId: z.string() },
      async ({ taskListId }) => [{ _id: taskListId, text: "Test task" }]
    )
  })
});

describe("server runtime", () => {
  test("invokes nested endpoints directly", async () => {
    await expect(server.tasks.get({ taskListId: "list_1" })).resolves.toEqual([
      { _id: "list_1", text: "Test task" }
    ]);
    await expect(server.health()).resolves.toEqual({ ok: true });
  });

  test("keeps client types aligned with the server", () => {
    const rpc = createClient<typeof server>({
      fetch: async (input, init) =>
        n.POSTHandler(
          server,
          new Request(String(input), {
            body: init?.body as BodyInit,
            headers: init?.headers,
            method: "POST"
          })
        ),
      url: "http://localhost/api/rpc"
    });

    expectTypeOf(rpc.health).toBeCallableWith();
    expectTypeOf(rpc.tasks.get).toBeCallableWith({ taskListId: "abc" });
    expectTypeOf(rpc.tasks.add).toBeCallableWith({ text: "abc" });
  });
});

describe("http adapters", () => {
  test("serves app router requests", async () => {
    const response = await n.POSTHandler(
      server,
      new Request("http://localhost/api/rpc", {
        body: JSON.stringify({
          args: { taskListId: "list_2" },
          path: ["tasks", "get"]
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      result: [{ _id: "list_2", text: "Test task" }]
    });
  });

  test("serves pages router requests", async () => {
    const handler = n.createPagesHandler(server);
    let statusCode = 200;
    let jsonBody: unknown;
    const headers = new Map<string, string>();

    await handler(
      {
        body: {
          args: { text: "Ship it" },
          path: ["tasks", "add"]
        },
        method: "POST"
      } as never,
      {
        json(body: unknown) {
          jsonBody = body;
        },
        setHeader(name: string, value: string) {
          headers.set(name, value);
        },
        status(code: number) {
          statusCode = code;
          return this;
        }
      } as never
    );

    expect(statusCode).toBe(200);
    expect(headers.size).toBe(0);
    expect(jsonBody).toEqual({
      ok: true,
      result: { ok: true, text: "Ship it" }
    });
  });

  test("client throws structured errors", async () => {
    const rpc = createClient<typeof server>({
      fetch: async (input, init) =>
        n.POSTHandler(
          server,
          new Request(String(input), {
            body: init?.body as BodyInit,
            headers: init?.headers,
            method: "POST"
          })
        ),
      url: "http://localhost/api/rpc"
    });

    await expect(rpc.tasks.get({ taskListId: 123 as never })).rejects.toMatchObject({
      name: "RpcClientError",
      status: 400
    });
  });
});
