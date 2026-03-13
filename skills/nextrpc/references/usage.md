# Usage Snippets

## App Router

```ts
import n from "zenrpc";
import { server } from "@/zenrpc/server";

export const POST = n.POSTHandler(server);
```

## Pages Router

```ts
import n from "zenrpc";
import { server } from "@/zenrpc/server";

export default n.createPagesHandler(server);
```

## Shared Client

```ts
import n from "zenrpc";
import type { PublicApi } from "./api-types";

export const rpc = n.createClient<PublicApi>({
  url: "/api/rpc"
});
```

If the code runs outside the browser, use an absolute URL:

```ts
const rpc = n.createClient<PublicApi>({
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

import n from "zenrpc";
import { z } from "zod";

export const server = n.createServer({
  tasks: n.createServer({
    add: n.endpoint({ text: z.string() }, async ({ text }) => {
      return { _id: crypto.randomUUID(), text };
    }),
    get: n.endpoint({ taskListId: z.string() }, async ({ taskListId }) => {
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
