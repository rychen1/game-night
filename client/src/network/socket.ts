import type { ClientMessage, ServerMessage } from "./messages.ts";
import {
  createConnectionGeneration,
  invokeLifecycleCallback,
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
  const connection = createConnectionGeneration();
  const ws = new WebSocket(socketUrl());

  ws.addEventListener("open", () => {
    invokeLifecycleCallback(connection, handlers.onOpen);
  });

  ws.addEventListener("close", () => {
    invokeLifecycleCallback(connection, handlers.onClose);
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
