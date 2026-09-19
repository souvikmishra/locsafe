export class NetworkGuardError extends Error {
  readonly url: string;

  constructor(url: string) {
    super(
      `Blocked network request to ${url}; only the configured JSON-RPC origin is allowed`,
    );
    this.name = "NetworkGuardError";
    this.url = url;
  }
}

type FetchFn = typeof fetch;

type GuardState = {
  rpcOrigin: string | null;
  selfOrigin: string | null;
  installed: boolean;
  originals: {
    fetch: FetchFn | null;
    xhrOpen: typeof XMLHttpRequest.prototype.open | null;
    webSocket: typeof WebSocket | null;
  };
};

const state: GuardState = {
  rpcOrigin: null,
  selfOrigin: null,
  installed: false,
  originals: {
    fetch: null,
    xhrOpen: null,
    webSocket: null,
  },
};

function originOf(url: string): string {
  return new URL(url, state.selfOrigin ?? "http://localhost").origin;
}

function isAllowed(url: string): boolean {
  if (!state.rpcOrigin) {
    return false;
  }
  const origin = originOf(url);
  if (origin === state.rpcOrigin) {
    return true;
  }
  if (state.selfOrigin && origin === state.selfOrigin) {
    return true;
  }
  return false;
}

function assertAllowed(url: string): void {
  if (!isAllowed(url)) {
    throw new NetworkGuardError(url);
  }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

export function installNetworkGuard(
  rpcUrl: string,
  options?: { selfOrigin?: string },
): void {
  state.rpcOrigin = new URL(rpcUrl).origin;
  state.selfOrigin =
    options?.selfOrigin ??
    (typeof window !== "undefined" ? window.location.origin : null);

  if (state.installed) {
    return;
  }
  state.installed = true;
  state.originals.fetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    try {
      assertAllowed(requestUrl(input));
    } catch (error) {
      return Promise.reject(error);
    }
    return state.originals.fetch!(input, init);
  }) as FetchFn;

  if (typeof XMLHttpRequest !== "undefined") {
    state.originals.xhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      assertAllowed(String(url));
      const open = state.originals.xhrOpen!;
      return open.apply(this, [method, url, ...rest] as never);
    };
  }

  if (typeof WebSocket !== "undefined") {
    const OriginalWebSocket = WebSocket;
    state.originals.webSocket = OriginalWebSocket;
    globalThis.WebSocket = class GuardedWebSocket extends OriginalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        assertAllowed(String(url));
        super(url, protocols);
      }
    };
  }
}

export function uninstallNetworkGuard(): void {
  if (!state.installed) {
    return;
  }
  if (state.originals.fetch) {
    globalThis.fetch = state.originals.fetch;
  }
  if (state.originals.xhrOpen && typeof XMLHttpRequest !== "undefined") {
    XMLHttpRequest.prototype.open = state.originals.xhrOpen;
  }
  if (state.originals.webSocket) {
    globalThis.WebSocket = state.originals.webSocket;
  }
  state.originals.fetch = null;
  state.originals.xhrOpen = null;
  state.originals.webSocket = null;
  state.installed = false;
}

export function resetNetworkGuard(): void {
  state.rpcOrigin = null;
  state.selfOrigin = null;
}

export function allowedRpcOrigin(): string | null {
  return state.rpcOrigin;
}
