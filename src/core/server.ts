import { z } from "zod";

import { NextrpcValidationError } from "./errors";
import {
  ENDPOINT_SYMBOL,
  ROUTER_SYMBOL,
  type AnyServerRouter,
  type ArgsDefinition,
  type ArgsInput,
  type EndpointDefinition,
  type EndpointRuntime,
  type JsonValue,
  type MaybePromise,
  type RawShapeInput,
  type RouterFromDefinition,
  type ServerEndpoint
} from "./types";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isZodSchema(value: unknown): value is z.ZodTypeAny {
  return isPlainRecord(value) && typeof value.safeParseAsync === "function";
}

function isEndpointDefinition(value: unknown): value is EndpointDefinition<unknown, unknown> {
  return isPlainRecord(value) && ENDPOINT_SYMBOL in value;
}

function isServerEndpoint(value: unknown): value is ServerEndpoint<unknown, unknown> {
  return typeof value === "function" && ENDPOINT_SYMBOL in value;
}

function isServerRouter(value: unknown): value is AnyServerRouter {
  return isPlainRecord(value) && ROUTER_SYMBOL in value;
}

function isEndpointConfig(
  value: unknown
): value is {
  args?: ArgsDefinition;
  handler: ((args: any) => MaybePromise<JsonValue | void>) | (() => MaybePromise<JsonValue | void>);
} {
  return isPlainRecord(value) && "handler" in value && typeof value.handler === "function";
}

function normalizeArgsSchema(args?: ArgsDefinition): z.ZodTypeAny | null {
  if (!args) {
    return null;
  }

  return isZodSchema(args) ? args : z.object(args);
}

function createEndpointRunner<TArgs, TOutput>(
  runtime: Pick<EndpointRuntime<TArgs, TOutput>, "argsSchema" | "handler">
): (rawArgs: unknown) => Promise<TOutput> {
  return async (rawArgs: unknown) => {
    if (!runtime.argsSchema) {
      if (rawArgs !== undefined) {
        throw new NextrpcValidationError("This endpoint does not accept arguments.");
      }

      return runtime.handler(undefined as TArgs);
    }

    const parsedArgs = await runtime.argsSchema.parseAsync(rawArgs);
    return runtime.handler(parsedArgs);
  };
}

function createServerEndpoint<TArgs, TOutput>(
  definition: EndpointDefinition<TArgs, TOutput>
): ServerEndpoint<TArgs, TOutput> {
  const runtime = definition[ENDPOINT_SYMBOL];
  const endpoint = (async (...args: unknown[]) => runtime.run(args[0])) as ServerEndpoint<TArgs, TOutput>;

  Object.defineProperty(endpoint, ENDPOINT_SYMBOL, {
    enumerable: false,
    value: runtime
  });

  return endpoint;
}

export function endpoint<TOutput extends JsonValue | void>(config: {
  handler: () => MaybePromise<TOutput>;
}): EndpointDefinition<void, Awaited<TOutput>>;

export function endpoint<TOutput extends JsonValue | void>(
  handler: () => MaybePromise<TOutput>
): EndpointDefinition<void, Awaited<TOutput>>;

export function endpoint<const TShape extends z.ZodRawShape, TOutput extends JsonValue | void>(config: {
  args: TShape;
  handler: (args: RawShapeInput<TShape>) => MaybePromise<TOutput>;
}): EndpointDefinition<RawShapeInput<TShape>, Awaited<TOutput>>;

export function endpoint<const TShape extends z.ZodRawShape, TOutput extends JsonValue | void>(
  args: TShape,
  handler: (args: RawShapeInput<TShape>) => MaybePromise<TOutput>
): EndpointDefinition<RawShapeInput<TShape>, Awaited<TOutput>>;

export function endpoint<TSchema extends z.ZodTypeAny, TOutput extends JsonValue | void>(config: {
  args: TSchema;
  handler: (args: z.input<TSchema>) => MaybePromise<TOutput>;
}): EndpointDefinition<z.input<TSchema>, Awaited<TOutput>>;

export function endpoint<TSchema extends z.ZodTypeAny, TOutput extends JsonValue | void>(
  args: TSchema,
  handler: (args: z.input<TSchema>) => MaybePromise<TOutput>
): EndpointDefinition<z.input<TSchema>, Awaited<TOutput>>;

export function endpoint(
  first:
    | ArgsDefinition
    | {
        args?: ArgsDefinition;
        handler:
          | ((args: any) => MaybePromise<JsonValue | void>)
          | (() => MaybePromise<JsonValue | void>);
      }
    | (() => MaybePromise<JsonValue | void>),
  second?: (args: any) => MaybePromise<JsonValue | void>
): EndpointDefinition<any, any> {
  let config: {
    args?: ArgsDefinition;
    handler: ((args: any) => MaybePromise<JsonValue | void>) | (() => MaybePromise<JsonValue | void>);
  };

  if (typeof first === "function") {
    config = { handler: first };
  } else if (second) {
    config = { args: first as ArgsDefinition, handler: second };
  } else if (isEndpointConfig(first)) {
    config = first;
  } else {
    throw new TypeError("Invalid endpoint definition.");
  }

  const argsSchema = normalizeArgsSchema(config.args);
  const handler =
    argsSchema === null
      ? (() => (config.handler as () => MaybePromise<JsonValue | void>)()) as (
          args: any
        ) => MaybePromise<JsonValue | void>
      : (config.handler as (args: any) => MaybePromise<JsonValue | void>);

  const runtime: EndpointRuntime<any, JsonValue | void> = {
    argsSchema: argsSchema as z.ZodType<any> | null,
    handler,
    run: async () => {
      throw new Error("Endpoint runner not initialized.");
    }
  };

  const definition: EndpointDefinition<any, any> = {
    [ENDPOINT_SYMBOL]: runtime
  };

  runtime.run = createEndpointRunner(runtime);

  return definition;
}

export function createServer<const TDefinition extends Record<string, unknown>>(
  definition: TDefinition
): RouterFromDefinition<TDefinition> {
  if (isServerRouter(definition)) {
    return definition as RouterFromDefinition<TDefinition>;
  }

  const router: Record<string, unknown> = {};

  Object.defineProperty(router, ROUTER_SYMBOL, {
    enumerable: false,
    value: true
  });

  for (const [key, value] of Object.entries(definition)) {
    if (isServerEndpoint(value)) {
      router[key] = value;
      continue;
    }

    if (isEndpointDefinition(value)) {
      router[key] = createServerEndpoint(value);
      continue;
    }

    if (isServerRouter(value)) {
      router[key] = value;
      continue;
    }

    if (isPlainRecord(value)) {
      router[key] = createServer(value);
      continue;
    }

    throw new TypeError(`Invalid value at key "${key}". Expected an endpoint or nested server.`);
  }

  return router as RouterFromDefinition<TDefinition>;
}
