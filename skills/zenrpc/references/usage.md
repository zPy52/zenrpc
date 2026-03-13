# Usage Snippets

## App Router

```ts
import zr from "zenrpc";
import { server } from "@/zenrpc/server";

export const POST = zr.POSTHandler(server);
```

## Pages Router

```ts
import zr from "zenrpc";
import { server } from "@/zenrpc/server";

export default zr.createPagesHandler(server);
```

## Shared Client

```ts
import zr from "zenrpc";
import type { PublicApi } from "./api-types";

export const rpc = zr.createClient<PublicApi>({
  url: "/api/rpc"
});
```

If the code runs outside the browser, use an absolute URL:

```ts
const rpc = zr.createClient<PublicApi>({
  url: "http://localhost:3000/api/rpc"
});
```

## API Types

```ts
import type { server } from "./server";

export type PublicApi = typeof server;
```

## Server

```ts
import "server-only";

import zr from "zenrpc";
import { z } from "zod";

export const server = zr.createServer({
  tasks: zr.createServer({
    add: zr.endpoint({ text: z.string() }, async ({ text }) => {
      return { _id: crypto.randomUUID(), text };
    }),
    get: zr.endpoint({ taskListId: z.string() }, async ({ taskListId }) => {
      return [{ _id: taskListId, text: "Example task" }];
    })
  })
});
```

## Direct Server Calls

```ts
await server.tasks.get({ taskListId: "default" });
await server.tasks.add({ text: "Ship ZenRPC" });
```

## Client Calls

```tsx
"use client";

import { useEffect, useState } from "react";

import { rpc } from "@/zenrpc/client";

export function TaskList() {
  const [tasks, setTasks] = useState<{ _id: string; text: string }[]>([]);

  useEffect(() => {
    void rpc.tasks.get({ taskListId: "default" }).then(setTasks);
  }, []);

  return (
    <button
      onClick={async () => {
        await rpc.tasks.add({ text: "Example task" });
      }}
    >
      Add task
    </button>
  );
}
```
