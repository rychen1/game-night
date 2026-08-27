import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGameSettings } from "../../protocol/messages.ts";

describe("parseGameSettings", () => {
  it("accepts standard kind-only settings", () => {
    assert.deepEqual(parseGameSettings({ kind: "hanabi" }), { kind: "hanabi" });
  });

  it("accepts The Gang mode settings", () => {
    assert.deepEqual(parseGameSettings({ kind: "theGang", mode: "advanced" }), {
      kind: "theGang",
      mode: "advanced",
    });
  });

  it("rejects unknown Gang modes", () => {
    assert.equal(parseGameSettings({ kind: "theGang", mode: "legendary" }), null);
  });

  it("rejects extra keys on The Gang settings", () => {
    assert.equal(
      parseGameSettings({ kind: "theGang", mode: "basic", extra: true }),
      null,
    );
  });
});
