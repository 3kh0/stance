import { onBeforeUnmount, ref } from "vue";

export interface ReconnectingSocketOptions {
  url: string;
  pingMs?: number;
  reconnectMs?: number;
  canConnect: () => boolean;
  subscribeMessage: () => unknown;
  onMessage: (raw: string) => void;
  onBeforeConnect?: () => void;
  onTeardown?: () => void;
}

export function useReconnectingSocket(options: ReconnectingSocketOptions) {
  const pingMs = options.pingMs ?? 10_000;
  const reconnectMs = options.reconnectMs ?? 2_000;
  const connected = ref(false);

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  function teardown() {
    if (pingTimer) clearInterval(pingTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    pingTimer = reconnectTimer = null;
    options.onTeardown?.();
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try {
        ws.close();
      } catch {}
      ws = null;
    }
    connected.value = false;
  }

  function scheduleReconnect() {
    if (stopped || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, reconnectMs);
  }

  function open() {
    if (!import.meta.client || stopped || !options.canConnect()) return;
    teardown();
    options.onBeforeConnect?.();
    try {
      ws = new WebSocket(options.url);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      connected.value = true;
      ws?.send(JSON.stringify(options.subscribeMessage()));
      pingTimer = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send("PING"), pingMs);
    };
    ws.onmessage = (e) => {
      const raw = typeof e.data === "string" ? e.data : "";
      if (raw && raw !== "PONG") options.onMessage(raw);
    };
    ws.onerror = () => ws?.close();
    ws.onclose = () => {
      connected.value = false;
      scheduleReconnect();
    };
  }

  onBeforeUnmount(() => {
    stopped = true;
    teardown();
  });

  return { connected, open, close: teardown };
}
