import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RoomError, RoomManager } from "./RoomManager.ts";

describe("RoomManager joinRoom errors", () => {
  it("reports when the room code does not exist", () => {
    const rooms = new RoomManager();

    assert.throws(
      () => rooms.joinRoom("ZZZZ", "Guest"),
      (error: unknown) => {
        assert.ok(error instanceof RoomError);
        assert.equal(error.message, "Room does not exist");
        return true;
      },
    );
  });

  it("requires a password for private rooms", () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom("Host", {
      visibility: "private",
      password: "secret",
    });

    assert.throws(
      () => rooms.joinRoom(room.code, "Guest"),
      (error: unknown) => {
        assert.ok(error instanceof RoomError);
        assert.equal(error.message, "Password required");
        return true;
      },
    );
  });

  it("reports an incorrect password for private rooms", () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom("Host", {
      visibility: "private",
      password: "secret",
    });

    assert.throws(
      () => rooms.joinRoom(room.code, "Guest", "wrong"),
      (error: unknown) => {
        assert.ok(error instanceof RoomError);
        assert.equal(error.message, "Incorrect password");
        return true;
      },
    );
  });

  it("joins a private room with the correct password", () => {
    const rooms = new RoomManager();
    const { room } = rooms.createRoom("Host", {
      visibility: "private",
      password: "secret",
    });

    const joined = rooms.joinRoom(room.code, "Guest", "secret");
    assert.equal(joined.room.code, room.code);
    assert.equal(joined.room.players.size, 2);
  });
});
