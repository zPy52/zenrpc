import type { z } from "zod";

export const ENDPOINT_SYMBOL = Symbol.for("zenrpc.endpoint");
export const ROUTER_SYMBOL = Symbol.for("zenrpc.router");

export type MaybePromise<T> = T | Promise<T>;

export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue | undefined };
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type AnyZodSchema = z.ZodTypeAny;
export type ArgsDefinition = z.ZodRawShape | AnyZodSchema;

export interface EndpointRuntime<TArgs, TOutput> {
  argsSchema: z.ZodType<TArgs> | null;
  handler: (args: TArgs) => MaybePromise<TOutput>;
  run: (args: unknown) => Promise<TOutput>;
}

export interface EndpointDefinition<TArgs, TOutput> {
  readonly [ENDPOINT_SYMBOL]: EndpointRuntime<TArgs, TOutput>;
}

export type ClientEndpoint<TArgs, TOutput> = [TArgs] extends [void]
  ? () => Promise<TOutput>
  : (args: TArgs) => Promise<TOutput>;

export type ServerEndpoint<TArgs, TOutput> = ClientEndpoint<TArgs, TOutput> & {
  readonly [ENDPOINT_SYMBOL]: EndpointRuntime<TArgs, TOutput>;
};

export type AnyServerRouter = {
  readonly [ROUTER_SYMBOL]: true;
};

type StringKeys<T> = keyof T extends infer TKey
  ? TKey extends string
    ? TKey
    : never
  : never;

export type NormalizedArgsSchema<TArgs extends ArgsDefinition> = TArgs extends z.ZodRawShape
  ? z.ZodObject<TArgs>
  : TArgs extends AnyZodSchema
    ? TArgs
    : never;

export type ArgsInput<TArgs extends ArgsDefinition> = z.input<NormalizedArgsSchema<TArgs>>;
export type RawShapeInput<TShape extends z.ZodRawShape> = {
  [TKey in keyof TShape]: z.input<TShape[TKey]>;
};

export type RouterFromDefinition<TValue> = TValue extends ServerEndpoint<infer TArgs, infer TOutput>
  ? ServerEndpoint<TArgs, TOutput>
  : TValue extends EndpointDefinition<infer TArgs, infer TOutput>
    ? ServerEndpoint<TArgs, TOutput>
    : TValue extends AnyServerRouter
      ? TValue
      : TValue extends Record<string, unknown>
        ? {
            [TKey in StringKeys<TValue>]: RouterFromDefinition<TValue[TKey]>;
          } & AnyServerRouter
        : never;

export type ClientFromServer<TValue> = TValue extends ServerEndpoint<infer TArgs, infer TOutput>
  ? ClientEndpoint<TArgs, TOutput>
  : TValue extends Record<string, unknown>
    ? {
        [TKey in StringKeys<TValue>]: ClientFromServer<TValue[TKey]>;
      }
    : never;

export interface RpcRequestEnvelope {
  path: string[];
  args?: unknown;
}

export interface SerializedRpcError {
  name: string;
  message: string;
  status: number;
  details?: unknown;
}

export interface RpcSuccessEnvelope<TResult = unknown> {
  ok: true;
  result?: TResult;
}

export interface RpcFailureEnvelope {
  ok: false;
  error: SerializedRpcError;
}

export type RpcResponseEnvelope<TResult = unknown> =
  | RpcSuccessEnvelope<TResult>
  | RpcFailureEnvelope;
