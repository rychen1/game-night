import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { RoomManager } from "./rooms/RoomManager.ts";
import { WebSocketManager } from "./websocket/WebSocketManager.ts";

const PORT = Number(process.env.PORT) || 3001;
const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** Production React build directory, resolved from the server package root. */
function resolveClientDistPath(): string | null {
  const candidates = [
    path.join(serverRoot, "public"),
    path.resolve(serverRoot, "../client/dist"),
    path.join(process.cwd(), "public"),
    path.resolve(process.cwd(), "../client/dist"),
    path.resolve(process.cwd(), "client/dist"),
  ];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  return null;
}

const clientDistPath = resolveClientDistPath();

const app = express();
app.use(cors());
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

if (clientDistPath) {
  app.use(express.static(clientDistPath, { fallthrough: true }));
  // SPA fallback for non-file GETs (does not affect /ws upgrades on the HTTP server).
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const rooms = new RoomManager();
new WebSocketManager(wss, rooms);

server.listen(PORT, () => {
  console.log(`Game Night server listening on http://localhost:${PORT}`);
});
