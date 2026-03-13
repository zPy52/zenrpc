import type { IncomingMessage, ServerResponse } from "node:http";

import { ZodError } from "zod";

import {
  NextrpcError,
  NextrpcNotFoundError,
  NextrpcValidationError,
  serializeRpcError
} from "./errors";
import {
  ENDPOINT_SYMBOL,
  ROUTER_SYMBOL,
  type EndpointRuntime,
  type RpcFailureEnvelope,
  type RpcRequestEnvelope
} from "./types";

type NodeLikeRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
};

type NodeLikeResponse = ServerResponse & {
  json(body: unknown): void;
  status(code: number): NodeLikeResponse;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRpcFailure(error: unknown): RpcFailureEnvelope {
  if (error instanceof ZodError) {
    return {
      error: serializeRpcError(
        new NextrpcValidationError("Invalid RPC arguments.", error.flatten())
      ),
      ok: false
    };
  }

  return {
    error: serializeRpcError(error),
    ok: false
  };
}

function validateEnvelope(value: unknown): RpcRequestEnvelope {
  if (!isPlainRecord(value)) {
    throw new NextrpcValidationError("RPC payload must be a JSON object.");
  }

  const { args, path } = value;

  if (!Array.isArray(path) || path.some((part) => typeof part !== "string")) {
    throw new NextrpcValidationError("RPC payload path must be a string array.");
  }

  return { args, path };
}

function resolveEndpoint(server: Record<string, unknown>, path: string[]): EndpointRuntime<unknown, unknown> {
  let current: unknown = server;

  for (const segment of path) {
    if (!isPlainRecord(current) || !(segment in current)) {
      throw new NextrpcNotFoundError(path);
    }

    current = current[segment];
  }

  if (typeof current !== "function" || !(ENDPOINT_SYMBOL in current)) {
    throw new NextrpcNotFoundError(path);
  }

  return current[ENDPOINT_SYMBOL] as EndpointRuntime<unknown, unknown>;
}

async function executeRpc(server: Record<string, unknown>, body: unknown) {
  const { args, path } = validateEnvelope(body);
  const endpoint = resolveEndpoint(server, path);
  return endpoint.run(args);
}

async function readJsonRequest(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    throw new NextrpcValidationError("Request body must be valid JSON.", error);
  }
}

async function readNodeBody(request: NodeLikeRequest): Promise<unknown> {
  if (request.body !== undefined) {
    if (typeof request.body === "string") {
      try {
        return JSON.parse(request.body);
      } catch (error) {
        throw new NextrpcValidationError("Request body must be valid JSON.", error);
      }
    }

    return request.body;
  }

  if (typeof request[Symbol.asyncIterator] !== "function") {
    throw new NextrpcValidationError("Unable to read request body.");
  }

  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8");

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new NextrpcValidationError("Request body must be valid JSON.", error);
  }
}

async function handleWebRequest(server: Record<string, unknown>, request: Request) {
  try {
    const result = await executeRpc(server, await readJsonRequest(request));

    return Response.json(
      result === undefined ? { ok: true } : { ok: true, result },
      { status: 200 }
    );
  } catch (error) {
    const failure = toRpcFailure(error);
    return Response.json(failure, { status: failure.error.status });
  }
}

export function POSTHandler<TServer extends Record<string, unknown>>(
  server: TServer
): (request: Request) => Promise<Response>;

export function POSTHandler<TServer extends Record<string, unknown>>(
  server: TServer,
  request: Request
): Promise<Response>;

export function POSTHandler<TServer extends Record<string, unknown>>(
  server: TServer,
  request?: Request
) {
  if (!(ROUTER_SYMBOL in server)) {
    throw new NextrpcError("POSTHandler expects a server created with createServer().", 500);
  }

  if (!request) {
    return async (nextRequest: Request) => handleWebRequest(server, nextRequest);
  }

  return handleWebRequest(server, request);
}

export function createPagesHandler<TServer extends Record<string, unknown>>(server: TServer) {
  if (!(ROUTER_SYMBOL in server)) {
    throw new NextrpcError(
      "createPagesHandler expects a server created with createServer().",
      500
    );
  }

  return async (request: NodeLikeRequest, response: NodeLikeResponse) => {
    if (request.method && request.method !== "POST") {
      response.setHeader("Allow", "POST");
      response.status(405).json({
        error: {
          message: "Method not allowed.",
          name: "MethodNotAllowed",
          status: 405
        },
        ok: false
      });
      return;
    }

    try {
      const result = await executeRpc(server, await readNodeBody(request));
      response.status(200).json(result === undefined ? { ok: true } : { ok: true, result });
    } catch (error) {
      const failure = toRpcFailure(error);
      response.status(failure.error.status).json(failure);
    }
  };
}
