We want to make a simpler version of tRPC, called ZenRPC. It should be as easy as to run one single command:

```bash
pnpm dlx zenrpc@latest init
# or npx zenrpc@latest init
# or yarn zenrpc@latest init
# or bunx --bun zenrpc@latest init
```

This would install the `zenrpc` package and do this setup:

src/
  app/
  ...
  zenrpc/
    client.ts
    api-types.ts
    server.ts

The `client.ts` is very simple:

```ts
import n from "zenrpc";
import type { PublicApi } from "@/zenrpc/api-types"

export const rpc = n.createClient<PublicApi>({
  url: "/api/rpc", // unnecessary: this comes by default
})
```

Then the `api-types` is just

```ts
import type { server } from "@/zenrpc/api-types"

export type PublicApi = typeof server
```

And then the `server` exposes a collection of routes:

```ts
"server-only"
import z from "zod"
import n from "zenrpc"

export const server = n.createServer({
  posts: {
    options: {
      get: n.endpoint({
        args: { postId: z.string() },
        handler: async (args) => {
          // ... retrieval logic
          return "example-post";
        },
      }),
    }
  },

  tasks: n.createServer({
    get: n.endpoint({
      args: { taskListId: z.string() },
      handler: async (args) => {
        // ... retrieval logic
        return ["example", "tasks", "list"];
      },
    }),
    add: n.endpoint({
      args: { text: z.string() },
      handler: async ({ text }) => {
        // ... add to db logic
      },
    })
  })
})
```

And at `/api/rpc/route.ts` we have:

```ts
import n from "zenrpc";
import { server } from "@/zenrpc/server";

export async function POST() {
  return n.POSTHandler(server);
}
```

The output values from the endpoints (here both query and mutation in one) should be JSON serializable, of course, and the client should have instantaneous full type safety when something changes in the exposed api.

This is used by the client as:

```tsx
"use client"
import Image from "next/image"
import { rpc } from "@/zenrpc/client"

export default function Home() {
  const [tasks, setTasks] = useState([]);
  
  useEffect(async () => {
    // this is a hook underneath; it's of type <whatever the return type of the query function is>; whenever an error happens in the server, it throws an error here
    setTasks(await rpc.tasks.get({ taskListId: "id1" }));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      {tasks?.map(({ _id, text }) => <div key={_id}>{text}</div>)}
      <button onClick={async () => {
        await rpc.tasks.add({ text: "example text" });
      }}>
        Add task
      </button>
    </main>
  );
}
```

And by the server as:

```ts
import { server } from "@/zenrpc/server"

await server.posts.options.get({ postId: "id1" }); // full type safety
await server.tasks.get({ taskListId: "id1" });
await server.tasks.add({ text: "content" });
```

This shall work well both for nextjs app router and for nextjs pages router