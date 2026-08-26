import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isReconnectFailureMessage,
  pendingShareCodeAfterEdit,
  resolveSessionStartup,
} from "./sessionStartup.ts";

describe("resolveSessionStartup", () => {
  it("reconnects when there is no share link and a saved token exists", () => {
    assert.deepEqual(
      resolveSessionStartup({
        shareCode: null,
        reconnectToken: "token-a",
        reconnectRoomCode: "AAAA",
      }),
      { shouldReconnect: true, discardReconnectSession: false },
    );
  });

  it("does not reconnect when there is no saved token", () => {
    assert.deepEqual(
      resolveSessionStartup({
        shareCode: "BBBB",
        reconnectToken: null,
        reconnectRoomCode: null,
      }),
      { shouldReconnect: false, discardReconnectSession: false },
    );
  });

  it("prefers a different-room share link over reconnecting to the saved room", () => {
    assert.deepEqual(
      resolveSessionStartup({
        shareCode: "BBBB",
        reconnectToken: "token-a",
        reconnectRoomCode: "AAAA",
      }),
      { shouldReconnect: false, discardReconnectSession: true },
    );
  });

  it("reconnects when the share link targets the same saved room", () => {
    assert.deepEqual(
      resolveSessionStartup({
        shareCode: "AAAA",
        reconnectToken: "token-a",
        reconnectRoomCode: "AAAA",
      }),
      { shouldReconnect: true, discardReconnectSession: false },
    );
  });

  it("prefers a share link when the saved reconnect room is unknown", () => {
    assert.deepEqual(
      resolveSessionStartup({
        shareCode: "BBBB",
        reconnectToken: "token-a",
        reconnectRoomCode: null,
      }),
      { shouldReconnect: false, discardReconnectSession: true },
    );
  });
});

describe("isReconnectFailureMessage", () => {
  it("recognizes invalid reconnect failures", () => {
    assert.equal(isReconnectFailureMessage("Unknown reconnect token"), true);
    assert.equal(isReconnectFailureMessage("Room no longer exists"), true);
  });

  it("ignores unrelated errors", () => {
    assert.equal(isReconnectFailureMessage("Password required"), false);
    assert.equal(isReconnectFailureMessage("This room is full"), false);
  });
});

describe("pendingShareCodeAfterEdit", () => {
  it("preserves pending share intent when the edited code still matches", () => {
    assert.equal(pendingShareCodeAfterEdit("BBBB", "bbbb"), "BBBB");
    assert.equal(pendingShareCodeAfterEdit("BBBB", " BBBB "), "BBBB");
  });

  it("clears pending share intent when the user edits away from the share code", () => {
    assert.equal(pendingShareCodeAfterEdit("BBBB", "CCCC"), null);
    assert.equal(pendingShareCodeAfterEdit("BBBB", ""), null);
    assert.equal(pendingShareCodeAfterEdit("BBBB", "abc"), null);
  });

  it("leaves null pending share code unchanged", () => {
    assert.equal(pendingShareCodeAfterEdit(null, "BBBB"), null);
  });
});
