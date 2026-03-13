# ZenRPC

Tiny type-safe RPC for Next.js.

ZenRPC keeps the mental model simple:

- Define your server API once with `createServer()`
- Validate inputs with `zod`
- Call endpoints from the client with full TypeScript inference
- Use the same server object directly on the server

It works with both the Next.js App Router and Pages Router.

## Install

```bash
pnpm add zenrpc zod
```

Or scaffold the recommended setup:

```bash
pnpm dlx zenrpc@latest init
# or npx zenrpc@latest init
# or yarn zenrpc@latest init
# or bunx --bun zenrpc@latest init
```

By default, `zenrpc init` creates:

```text
src/
  zenrpc/
    api-types.ts
    client.ts
    server.ts
```

And it also creates the route handler for your Next.js router.

## Quick Start

### 1. Define your server

```ts
import "server-only";

import zr from "zenrpc";
import { z } from "zod";

export const server = zr.createServer({
  tasks: {
    list: zr.endpoint(async () => [
      { id: "task_1", text: "Ship ZenRPC" },
      { id: "task_2", text: "Write docs" }
    ]),
    add: zr.endpoint({ text: z.string() }, async ({ text }) => {
      return { id: crypto.randomUUID(), text };
    })
  }
});
```

### 2. Export the API type

```ts
import type { server } from "./server";

export type PublicApi = typeof server;
```

### 3. Create the client

```ts
import zr from "zenrpc";
import type { PublicApi } from "./api-types";

export const rpc = zr.createClient<PublicApi>({
  url: "/api/rpc"
});
```

### 4. Add the route handler

App Router:

```ts
import zr from "zenrpc";
import { server } from "@/zenrpc/server";

export const POST = zr.POSTHandler(server);
```

Pages Router:

```ts
import zr from "zenrpc";
import { server } from "@/zenrpc/server";

export default zr.createPagesHandler(server);
```

## Calling From The Client

```tsx
"use client";

import { useEffect, useState } from "react";
import { rpc } from "@/zenrpc/client";

type Task = {
  id: string;
  text: string;
};

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    void rpc.tasks.list().then(setTasks);
  }, []);

  return (
    <main>
      {tasks.map((task) => (
        <div key={task.id}>{task.text}</div>
      ))}

      <button
        onClick={async () => {
          const newTask = await rpc.tasks.add({ text: "New task" });
          setTasks((current) => [...current, newTask]);
        }}
      >
        Add task
      </button>
    </main>
  );
}
```

If the server throws, the client throws a `RpcClientError` with:

- `message`
- `status`
- `path`
- `details`

## Calling From The Server

The same server object is directly callable on the server with full types:

```ts
import { server } from "@/zenrpc/server";

await server.tasks.list();
await server.tasks.add({ text: "Write docs" });
```

## API

### `createServer()`

Builds a nested RPC router from plain objects.

```ts
const server = zr.createServer({
  health: zr.endpoint(async () => "ok")
});
```

### `endpoint()`

Creates an endpoint with optional `zod` validation.

No args:

```ts
const ping = zr.endpoint(async () => "pong");
```

With args:

```ts
const getPost = zr.endpoint({ postId: z.string() }, async ({ postId }) => {
  return { id: postId };
});
```

You can also pass a config object:

```ts
const getPost = zr.endpoint({
  args: { postId: z.string() },
  handler: async ({ postId }) => ({ id: postId })
});
```

### `createClient()`

Creates a typed client from your server type.

```ts
const rpc = zr.createClient<PublicApi>({
  url: "/api/rpc",
  headers: async () => ({
    authorization: "Bearer token"
  })
});
```

Options:

- `url` defaults to `"/api/rpc"`
- `fetch` lets you provide a custom fetch implementation
- `headers` can be an object or an async function

### `POSTHandler()`

Creates a `POST` route handler for the Next.js App Router.

### `createPagesHandler()`

Creates an API route handler for the Next.js Pages Router.

## CLI

```bash
zenrpc init [--router app|pages|both|auto] [--dir src/zenrpc] [--force] [--no-install]
```

Examples:

```bash
zenrpc init
zenrpc init --router pages
zenrpc init --router both --dir src/lib/zenrpc
zenrpc init --force --no-install
```

Flags:

- `--router` chooses `app`, `pages`, `both`, or `auto`
- `--dir` changes where `client.ts`, `api-types.ts`, and `server.ts` are generated
- `--force` overwrites existing generated files
- `--no-install` skips dependency installation

## Notes

- Endpoint results must be JSON-serializable
- If an endpoint has no args, call it with no parameters
- If validation fails, ZenRPC returns a typed error response with status `400`
- Unknown endpoints return `404`

## License

MIT
