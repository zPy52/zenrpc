import { RpcClientError } from "./errors";
import type { ClientFromServer } from "./index-types";
import type { RpcFailureEnvelope, RpcResponseEnvelope } from "./types";

export interface CreateClientOptions {
  fetch?: typeof globalThis.fetch;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  url?: string;
}

async function resolveHeaders(headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>)) {
  const resolved = typeof headers === "function" ? await headers() : headers;
  return new Headers(resolved);
}

async function parseResponse(response: Response, path: string[]): Promise<RpcResponseEnvelope> {
  try {
    return (await response.json()) as RpcResponseEnvelope;
  } catch (error) {
    throw new RpcClientError({
      details: error,
      message: "RPC response was not valid JSON.",
      path,
      status: response.status || 500
    });
  }
}

export function createClient<TServer>(options: CreateClientOptions = {}): ClientFromServer<TServer> {
  const requestUrl = options.url ?? "/api/rpc";
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error("No fetch implementation is available. Pass createClient({ fetch }).");
  }

  const call = async (path: string[], args: unknown) => {
    const headers = await resolveHeaders(options.headers);
    headers.set("content-type", "application/json");

    let response: Response;

    try {
      response = await fetchImpl(requestUrl, {
        body: JSON.stringify(args === undefined ? { path } : { args, path }),
        headers,
        method: "POST"
      });
    } catch (error) {
      throw new RpcClientError({
        details: error,
        message: error instanceof Error ? error.message : "RPC request failed.",
        path,
        status: 0
      });
    }

    const envelope = await parseResponse(response, path);

    if (!("ok" in envelope)) {
      throw new RpcClientError({
        message: "RPC response had an unexpected shape.",
        path,
        status: response.status || 500
      });
    }

    if (!envelope.ok) {
      const failure = envelope as RpcFailureEnvelope;
      throw new RpcClientError({
        details: failure.error.details,
        message: failure.error.message,
        path,
        status: failure.error.status
      });
    }

    return envelope.result;
  };

  const buildProxy = (path: string[]): unknown =>
    new Proxy(() => undefined, {
      apply(_target, _thisArg, args) {
        return call(path, args[0]);
      },
      get(_target, property) {
        if (property === "then") {
          return undefined;
        }

        if (typeof property !== "string") {
          return undefined;
        }

        return buildProxy([...path, property]);
      }
    });

  return buildProxy([]) as ClientFromServer<TServer>;
}
