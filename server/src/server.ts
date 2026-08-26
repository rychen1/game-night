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
const clientDistPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../client/dist",
);

const app = express();
app.use(cors());
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
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
