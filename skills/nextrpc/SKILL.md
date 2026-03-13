---
name: zenrpc
description: Scaffold, wire, or update ZenRPC in a Next.js project. Use when Codex needs to add a typed RPC layer with `zenrpc`, generate the standard `src/zenrpc/` files, create app-router or pages-router handlers, explain how to call endpoints from the client or server, or run the `pnpm dlx zenrpc@latest init` setup flow.
---

# ZenRPC

Use this skill to add or maintain a `zenrpc` setup in a Next.js app.

## Quick Start

Prefer the CLI when the project needs the standard layout:

```bash
pnpm dlx zenrpc@latest init
```

Use flags when needed:

- `--router app`
- `--router pages`
- `--router both`
- `--force`
- `--no-install`
- `--dir src/zenrpc`

The scaffold creates:

- `src/zenrpc/client.ts`
- `src/zenrpc/api-types.ts`
- `src/zenrpc/server.ts`
- `src/app/api/rpc/route.ts` or `src/pages/api/rpc.ts`

If the project already has a root-level `app/` or `pages/` directory, the route file goes there while the shared RPC files still default to `src/zenrpc/`.

## Workflow

1. Check whether the project already has `src/app`, `app`, `src/pages`, or `pages`.
2. Prefer `pnpm dlx zenrpc@latest init` unless the user explicitly wants manual setup.
3. For pages router, use `pnpm dlx zenrpc@latest init --router pages`.
4. For mixed projects, use `--router both`.
5. If files already exist, inspect them before using `--force`.

## Authoring Endpoints

Prefer the two-argument form for endpoints with inputs:

```ts
get: n.endpoint({ taskListId: z.string() }, async ({ taskListId }) => {
  return [{ _id: taskListId, text: "Example task" }];
})
```

That form gives the best handler-argument inference.

The config-object form also exists:

```ts
n.endpoint({
  args: { taskListId: z.string() },
  handler: async (args) => { ... }
})
```

Use it only when you do not need destructured handler-argument inference, or when you are willing to annotate the handler argument explicitly. This is a TypeScript contextual-typing limitation, not a runtime difference.

Return only JSON-serializable data or `void`.

## Wiring Rules

- In `client.ts`, use `n.createClient<PublicApi>()`.
- In `api-types.ts`, export `type PublicApi = typeof server`.
- In `server.ts`, build the tree with `n.createServer(...)`.
- For app router, use `export const POST = n.POSTHandler(server)`.
- For pages router, use `export default n.createPagesHandler(server)`.
- Call server endpoints directly with `await server.tasks.get(...)` when you are already on the server.

## Client Rules

- The default client URL is `/api/rpc`.
- When the client runs outside the browser, pass an absolute URL.
- Server-side validation failures and handler errors come back as `RpcClientError` on the client.

## Reference

Read [references/usage.md](references/usage.md) when you need copyable snippets for app router, pages router, or direct client/server usage.
