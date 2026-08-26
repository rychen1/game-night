import type { ClientMessage, ServerMessage } from "./messages.ts";

const TOKEN_KEY = "game-night.reconnectToken";
const NAME_KEY = "game-night.name";

export function loadReconnectToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveReconnectToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearReconnectToken(): void {
  localStorage.removeItem(TOKEN_KEY);
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
  const ws = new WebSocket(socketUrl());

  ws.addEventListener("open", () => {
    handlers.onOpen();
  });

  ws.addEventListener("close", () => {
    handlers.onClose();
  });

  ws.addEventListener("message", (event) => {
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

  return {
    send(message) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    },
    close() {
      ws.close();
    },
  };
}
