import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import {
  parseClientMessage,
  type ClientMessage,
  type ServerMessage,
} from "../protocol/messages.ts";
import { RoomError, RoomManager } from "../rooms/RoomManager.ts";
import { GameError } from "../games/Game.ts";
import type { Room } from "../rooms/Room.ts";
import type { Player } from "../players/Player.ts";

export class WebSocketManager {
  private playerIdBySocket = new Map<WebSocket, string>();
  private socketByPlayerId = new Map<string, WebSocket>();

  constructor(
    private wss: WebSocketServer,
    private rooms: RoomManager,
  ) {
    this.rooms.setRoomTimerListener((room) => {
      this.broadcastRoom(room);
    });
    this.wss.on("connection", (socket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: WebSocket): void {
    socket.on("message", (raw) => {
      try {
        this.handleMessage(socket, raw.toString());
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected server error";
        this.send(socket, { type: "error", message });
      }
    });

    socket.on("close", () => {
      this.handleDisconnect(socket);
    });
  }

  private handleMessage(socket: WebSocket, raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.send(socket, { type: "error", message: "Invalid JSON" });
      return;
    }

    const result = parseClientMessage(parsed);
    if (!result.ok) {
      this.send(socket, { type: "error", message: result.error });
      return;
    }

    try {
      this.dispatch(socket, result.message);
    } catch (error) {
      if (error instanceof RoomError || error instanceof GameError) {
        this.send(socket, { type: "error", message: error.message });
        return;
      }
      throw error;
    }
  }

  private dispatch(socket: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case "ping":
        this.send(socket, { type: "pong" });
        return;
      case "list_rooms": {
        this.send(socket, {
          type: "room_list",
          rooms: this.rooms.listRooms(),
        });
        return;
      }
      case "create_room": {
        const options: {
          visibility: typeof message.visibility;
          password?: string;
        } = { visibility: message.visibility };
        if (message.password !== undefined) {
          options.password = message.password;
        }
        const { player, room } = this.rooms.createRoom(message.name, options);
        this.attach(socket, player.id);
        this.send(socket, {
          type: "room_created",
          roomCode: room.code,
          playerId: player.id,
          reconnectToken: player.reconnectToken,
        });
        this.broadcastRoom(room);
        return;
      }
      case "join_room": {
        const { player, room } = this.rooms.joinRoom(
          message.roomCode,
          message.name,
          message.password,
        );
        this.attach(socket, player.id);
        this.sendWelcome(socket, player);
        this.broadcastRoom(room);
        return;
      }
      case "reconnect": {
        const { player, room } = this.rooms.reconnect(message.reconnectToken);
        this.attach(socket, player.id);
        this.sendWelcome(socket, player);
        this.broadcastRoom(room);
        return;
      }
      case "set_name": {
        const playerId = this.requirePlayerId(socket);
        const { room } = this.rooms.setName(playerId, message.name);
        this.broadcastRoom(room);
        return;
      }
      case "select_game": {
        const playerId = this.requirePlayerId(socket);
        const { room } = this.rooms.selectGame(playerId, message.gameId);
        this.broadcastRoom(room);
        return;
      }
      case "update_game_settings": {
        const playerId = this.requirePlayerId(socket);
        const { room } = this.rooms.updateGameSettings(
          playerId,
          message.settings,
        );
        this.broadcastRoom(room);
        return;
      }
      case "cancel_game_setup": {
        const playerId = this.requirePlayerId(socket);
        const { room } = this.rooms.cancelGameSetup(playerId);
        this.broadcastRoom(room);
        return;
      }
      case "set_ready": {
        const playerId = this.requirePlayerId(socket);
        const { room } = this.rooms.setReady(playerId, message.ready);
        this.broadcastRoom(room);
        return;
      }
      case "start_game": {
        const playerId = this.requirePlayerId(socket);
        const { room } = this.rooms.startGame(playerId);
        this.broadcast(room, { type: "game_started" });
        this.broadcastRoom(room);
        return;
      }
      case "leave_room": {
        const playerId = this.requirePlayerId(socket);
        this.playerIdBySocket.delete(socket);
        this.socketByPlayerId.delete(playerId);
        const room = this.rooms.leaveRoom(playerId);
        this.send(socket, { type: "left_room", reason: "left" });
        if (room) {
          this.broadcastRoom(room);
        }
        return;
      }
      case "remove_player": {
        const hostId = this.requirePlayerId(socket);
        const targetId = message.playerId;
        const targetSocket = this.socketByPlayerId.get(targetId);
        const { room } = this.rooms.removePlayer(hostId, targetId);
        if (targetSocket) {
          this.playerIdBySocket.delete(targetSocket);
          this.socketByPlayerId.delete(targetId);
          this.send(targetSocket, { type: "left_room", reason: "removed" });
        }
        if (room) {
          this.broadcastRoom(room);
        }
        return;
      }
      case "return_to_lobby": {
        const playerId = this.requirePlayerId(socket);
        const { room } = this.rooms.returnToLobby(playerId);
        this.broadcastRoom(room);
        return;
      }
      case "play_again": {
        const playerId = this.requirePlayerId(socket);
        const { room } = this.rooms.playAgain(playerId);
        this.broadcast(room, { type: "game_started" });
        this.broadcastRoom(room);
        return;
      }
      case "game_action": {
        const playerId = this.requirePlayerId(socket);
        const { room } = this.rooms.performGameAction(playerId, message.action);
        this.broadcastRoom(room);
        return;
      }
    }
  }

  private handleDisconnect(socket: WebSocket): void {
    const playerId = this.playerIdBySocket.get(socket);
    if (!playerId) {
      return;
    }
    this.playerIdBySocket.delete(socket);
    if (this.socketByPlayerId.get(playerId) !== socket) {
      return;
    }
    this.socketByPlayerId.delete(playerId);
    const room = this.rooms.disconnect(playerId);
    if (room) {
      this.broadcastRoom(room);
    }
  }

  private attach(socket: WebSocket, playerId: string): void {
    const previous = this.socketByPlayerId.get(playerId);
    if (previous && previous !== socket) {
      this.playerIdBySocket.delete(previous);
      try {
        previous.close();
      } catch {
        // Ignore sockets that are already closed.
      }
    }
    this.playerIdBySocket.set(socket, playerId);
    this.socketByPlayerId.set(playerId, socket);
  }

  private requirePlayerId(socket: WebSocket): string {
    const playerId = this.playerIdBySocket.get(socket);
    if (!playerId) {
      throw new RoomError("You are not in a room");
    }
    return playerId;
  }

  private sendWelcome(socket: WebSocket, player: Player): void {
    this.send(socket, {
      type: "welcome",
      playerId: player.id,
      reconnectToken: player.reconnectToken,
    });
  }

  private broadcastRoom(room: Room): void {
    const state = this.rooms.toPublicState(room);
    for (const player of room.players.values()) {
      const socket = this.socketByPlayerId.get(player.id);
      if (!socket || socket.readyState !== socket.OPEN) {
        continue;
      }
      this.send(socket, { type: "room_state", state });
      if (room.game) {
        this.send(socket, {
          type: "private_state",
          state: room.game.getPrivateState(player.id),
        });
      }
    }
  }

  private broadcast(room: Room, message: ServerMessage): void {
    for (const player of room.players.values()) {
      const socket = this.socketByPlayerId.get(player.id);
      if (!socket || socket.readyState !== socket.OPEN) {
        continue;
      }
      this.send(socket, message);
    }
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState !== socket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(message));
  }
}
