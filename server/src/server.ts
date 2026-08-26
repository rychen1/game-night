import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { RoomManager } from "./rooms/RoomManager.ts";
import { WebSocketManager } from "./websocket/WebSocketManager.ts";

const PORT = 3001;

const app = express();
app.use(cors());
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const rooms = new RoomManager();
new WebSocketManager(wss, rooms);

server.listen(PORT, () => {
  console.log(`Game Night server listening on http://localhost:${PORT}`);
});
