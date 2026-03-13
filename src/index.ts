import { createClient } from "./core/client";
import { RpcClientError } from "./core/errors";
import { createPagesHandler, POSTHandler } from "./core/http";
import { createServer, endpoint } from "./core/server";

export type {
  AnyServerRouter,
  ArgsDefinition,
  ArgsInput,
  ClientEndpoint,
  EndpointDefinition,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  RpcFailureEnvelope,
  RpcRequestEnvelope,
  RpcResponseEnvelope,
  RpcSuccessEnvelope,
  SerializedRpcError,
  ServerEndpoint
} from "./core/types";
export type { ClientFromServer } from "./core/index-types";
export { createClient, createPagesHandler, createServer, endpoint, POSTHandler, RpcClientError };

const zenrpc: {
  POSTHandler: typeof POSTHandler;
  RpcClientError: typeof RpcClientError;
  createClient: typeof createClient;
  createPagesHandler: typeof createPagesHandler;
  createServer: typeof createServer;
  endpoint: typeof endpoint;
} = {
  createClient,
  createPagesHandler,
  createServer,
  endpoint,
  POSTHandler,
  RpcClientError
};

export default zenrpc;
