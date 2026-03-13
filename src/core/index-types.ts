import type { ClientFromServer } from "./types";

export type { ClientFromServer };

export type HeadersFactory = HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
