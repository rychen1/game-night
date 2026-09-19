import type { ClientMessage, ServerMessage } from "./messages.ts";
import {
  createConnectionGeneration,
  invokeLifecycleCallback,
  nextReconnectDelayMs,
  PING_INTERVAL_MS,
  shouldAttemptImmediateReconnect,
  shouldScheduleReconnect,
  type ConnectionGeneration,
} from "./socketLifecycle.ts";

const TOKEN_KEY = "game-night.reconnectToken";
const ROOM_CODE_KEY = "game-night.reconnectRoomCode";
const NAME_KEY = "game-night.name";

export function loadReconnectToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function loadReconnectRoomCode(): string | null {
  return localStorage.getItem(ROOM_CODE_KEY);
}

export function saveReconnectToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function saveReconnectRoomCode(roomCode: string): void {
  localStorage.setItem(ROOM_CODE_KEY, roomCode);
}

export function clearReconnectToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROOM_CODE_KEY);
}

export function loadSavedName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function saveName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}

function socketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export function connectSocket(handlers: {
  onOpen: () => void;
  onClose: () => void;
  onMessage: (message: ServerMessage) => void;
}): { send: (message: ClientMessage) => void; close: () => void } {
  let closedByClient = false;
  let ws: WebSocket | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let failedAttempts = 0;

  function clearPing(): void {
    if (pingTimer !== null) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function startPing(): void {
    clearPing();
    pingTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL_MS);
  }

  function bindSocket(socket: WebSocket, generation: ConnectionGeneration): void {
    socket.addEventListener("open", () => {
      failedAttempts = 0;
      startPing();
      invokeLifecycleCallback(generation, handlers.onOpen);
    });

    socket.addEventListener("close", () => {
      clearPing();
      invokeLifecycleCallback(generation, handlers.onClose);
      if (!shouldScheduleReconnect(closedByClient)) {
        return;
      }
      scheduleReconnect();
    });

    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") {
        return;
      }
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        handlers.onMessage(message);
      } catch {
        // Ignore malformed payloads from the server.
      }
    });
  }

  function openSocket(): void {
    const generation = createConnectionGeneration();
    ws = new WebSocket(socketUrl());
    bindSocket(ws, generation);
  }

  function scheduleReconnect(): void {
    if (closedByClient || reconnectTimer !== null) {
      return;
    }
    const delay = nextReconnectDelayMs(failedAttempts);
    failedAttempts += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (closedByClient) {
        return;
      }
      openSocket();
    }, delay);
  }

  function reconnectNow(): void {
    if (
      !shouldAttemptImmediateReconnect({
        closedByClient,
        readyState: ws?.readyState ?? WebSocket.CLOSED,
        connecting: WebSocket.CONNECTING,
        open: WebSocket.OPEN,
      })
    ) {
      return;
    }
    clearReconnectTimer();
    failedAttempts = 0;
    openSocket();
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === "visible") {
      reconnectNow();
    }
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("online", reconnectNow);

  openSocket();

  return {
    send(message) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    },
    close() {
      closedByClient = true;
      clearPing();
      clearReconnectTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", reconnectNow);
      ws?.close();
    },
  };
}
