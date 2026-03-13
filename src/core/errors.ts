import type { SerializedRpcError } from "./types";

export class NextrpcError extends Error {
  public readonly details?: unknown;
  public readonly status: number;

  public constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.details = details;
  }
}

export class NextrpcValidationError extends NextrpcError {
  public constructor(message: string, details?: unknown) {
    super(message, 400, details);
  }
}

export class NextrpcNotFoundError extends NextrpcError {
  public constructor(path: string[]) {
    super(`Unknown RPC endpoint: ${path.join(".") || "<root>"}.`, 404);
  }
}

export class RpcClientError extends Error {
  public readonly details?: unknown;
  public readonly path: string[];
  public readonly status: number;

  public constructor(options: { message: string; status: number; path: string[]; details?: unknown }) {
    super(options.message);
    this.name = "RpcClientError";
    this.status = options.status;
    this.path = options.path;
    this.details = options.details;
  }
}

export function serializeRpcError(error: unknown): SerializedRpcError {
  if (error instanceof NextrpcError) {
    return {
      details: error.details,
      message: error.message,
      name: error.name,
      status: error.status
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      status: 500
    };
  }

  return {
    details: error,
    message: "Unknown RPC error.",
    name: "UnknownError",
    status: 500
  };
}
