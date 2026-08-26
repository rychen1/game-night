import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ROOM_CODE_QUERY_PARAM,
  buildRoomShareUrl,
  buildShareUrl,
  normalizeRoomCode,
  parseRoomCodeFromPath,
  parseRoomCodeFromSearch,
  parseRoomShareLocation,
  parseRoomShareUrl,
  roomShareInvitationUrl,
} from "./roomShare.ts";

describe("normalizeRoomCode", () => {
  it("accepts valid codes", () => {
    assert.equal(normalizeRoomCode("7k4p"), "7K4P");
    assert.equal(normalizeRoomCode(" ABCD "), "ABCD");
  });

  it("rejects invalid codes", () => {
    assert.equal(normalizeRoomCode(""), null);
    assert.equal(normalizeRoomCode("ABC"), null);
    assert.equal(normalizeRoomCode("ABCDE"), null);
    assert.equal(normalizeRoomCode("ABCD!"), null);
  });
});

describe("parseRoomCodeFromSearch", () => {
  it("reads the code query parameter", () => {
    assert.equal(parseRoomCodeFromSearch("?code=7K4P"), "7K4P");
    assert.equal(parseRoomCodeFromSearch("code=7k4p"), "7K4P");
  });

  it("ignores missing or invalid values", () => {
    assert.equal(parseRoomCodeFromSearch(""), null);
    assert.equal(parseRoomCodeFromSearch("?code=ABC"), null);
    assert.equal(parseRoomCodeFromSearch("?other=7K4P"), null);
  });
});

describe("parseRoomCodeFromPath", () => {
  it("reads /join/XXXX paths", () => {
    assert.equal(parseRoomCodeFromPath("/join/7K4P"), "7K4P");
    assert.equal(parseRoomCodeFromPath("/join/7k4p/"), "7K4P");
  });

  it("ignores other paths", () => {
    assert.equal(parseRoomCodeFromPath("/"), null);
    assert.equal(parseRoomCodeFromPath("/join/ABC"), null);
  });
});

describe("parseRoomShareLocation", () => {
  it("prefers the query parameter over the path", () => {
    assert.equal(
      parseRoomShareLocation("/join/ZZZZ", "?code=7K4P"),
      "7K4P",
    );
  });
});

describe("buildRoomShareUrl", () => {
  it("builds a canonical origin URL with the code query param", () => {
    assert.equal(
      buildRoomShareUrl("7k4p", "https://game-night.example"),
      `https://game-night.example/?${ROOM_CODE_QUERY_PARAM}=7K4P`,
    );
  });

  it("rejects invalid room codes", () => {
    assert.throws(() => buildRoomShareUrl("bad", "https://example.test"));
  });
});

describe("buildShareUrl", () => {
  it("includes the room code and is not just the host", () => {
    const url = buildShareUrl("ABCD", "https://game-night.example");
    assert.match(url, /ABCD/);
    assert.match(url, /\?code=ABCD$/);
    assert.notEqual(url, "https://game-night.example");
    assert.notEqual(url, "https://game-night.example/");
  });
});

describe("parseRoomShareUrl", () => {
  it("recovers the room code from a generated invitation URL", () => {
    const url = buildShareUrl("ABCD", "https://game-night.example");
    assert.equal(parseRoomShareUrl(url), "ABCD");
  });

  it("recovers the room code from /join/ alias URLs", () => {
    assert.equal(
      parseRoomShareUrl("https://game-night.example/join/ABCD"),
      "ABCD",
    );
  });
});

describe("roomShareInvitationUrl", () => {
  it("returns the complete invitation URL used by copy and QR", () => {
    const url = roomShareInvitationUrl("ABCD", "https://game-night.example");
    assert.equal(url, `https://game-night.example/?${ROOM_CODE_QUERY_PARAM}=ABCD`);
  });

  it("matches buildShareUrl for the QR and clipboard payload", () => {
    const origin = "https://game-night.example";
    assert.equal(
      roomShareInvitationUrl("ABCD", origin),
      buildShareUrl("ABCD", origin),
    );
  });

  it("returns null for invalid room codes", () => {
    assert.equal(roomShareInvitationUrl("bad", "https://example.test"), null);
  });
});
