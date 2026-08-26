import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGame } from "../games/createGame.ts";
import { RoomManager } from "./RoomManager.ts";

function startCrewLobbyGame(rooms: RoomManager): {
  hostId: string;
  guestId: string;
  hostToken: string;
  roomCode: string;
} {
  const host = rooms.createRoom("Host", { visibility: "public" });
  const guest = rooms.joinRoom(host.room.code, "Guest");
  rooms.selectGame(host.player.id, "crew");
  for (const player of guest.room.players.values()) {
    rooms.setReady(player.id, true);
  }
  rooms.startGame(host.player.id);
  return {
    hostId: host.player.id,
    guestId: guest.player.id,
    hostToken: host.player.reconnectToken,
    roomCode: host.room.code,
  };
}

describe("RoomManager reconnect during an in-memory Crew game", () => {
  it("restores the same player identity without creating a duplicate seat", () => {
    const rooms = new RoomManager();
    const { hostId, guestId, hostToken, roomCode } = startCrewLobbyGame(rooms);

    assert.equal(rooms.getPlayer(hostId)?.roomCode, roomCode);
    assert.equal(rooms.getPlayer(guestId)?.roomCode, roomCode);

    rooms.disconnect(hostId);
    assert.equal(rooms.getPlayer(hostId)?.connected, false);

    const reconnected = rooms.reconnect(hostToken);
    assert.equal(reconnected.player.id, hostId);
    assert.equal(reconnected.room.code, roomCode);
    assert.equal(reconnected.room.players.size, 2);
    assert.equal(reconnected.player.connected, true);
    assert.ok(reconnected.room.game);
    assert.equal(reconnected.room.game.getPublicState().kind, "crew");
    assert.ok(reconnected.room.players.has(guestId));
    assert.ok(reconnected.room.players.has(hostId));
  });

  it("preserves Crew game state across reconnect", () => {
    const rooms = new RoomManager();
    const { hostId, hostToken } = startCrewLobbyGame(rooms);

    rooms.disconnect(hostId);
    const restored = rooms.reconnect(hostToken);
    const after = rooms.toPublicState(restored.room);

    assert.equal(after.publicGame?.kind, "crew");
    if (after.publicGame?.kind === "crew") {
      assert.equal(after.publicGame.phase, "TASKS");
    }
    assert.equal(after.players.length, 2);
  });

  it("does not duplicate players when the same token reconnects", () => {
    const rooms = new RoomManager();
    const { hostToken } = startCrewLobbyGame(rooms);

    const first = rooms.reconnect(hostToken);
    const second = rooms.reconnect(hostToken);

    assert.equal(first.player.id, second.player.id);
    assert.equal(first.room.players.size, 2);
    assert.equal(second.room.players.size, 2);
  });
});

describe("RoomManager Crew game setup via createGame", () => {
  it("creates a playable Crew module from registry settings", () => {
    const game = createGame("crew", { kind: "crew" });
    game.setup(["alpha", "beta"]);
    const state = game.getPublicState();
    assert.equal(state.kind, "crew");
    if (state.kind === "crew") {
      assert.equal(state.phase, "TASKS");
    }
    assert.equal(game.canStart(2), null);
  });
});
