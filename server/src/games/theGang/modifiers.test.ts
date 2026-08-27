import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alarmsToLoseForMode,
  challengePoolForMode,
  drawNextChallenge,
  toModifierView,
} from "./modifiers.ts";

describe("The Gang modifiers", () => {
  it("uses two alarms in Master Thief mode", () => {
    assert.equal(alarmsToLoseForMode("masterThief"), 2);
    assert.equal(alarmsToLoseForMode("basic"), 3);
  });

  it("excludes Quick Access from professional and master thief pools", () => {
    assert.equal(challengePoolForMode("advanced").includes("quickAccess"), true);
    assert.equal(challengePoolForMode("professional").includes("quickAccess"), false);
    assert.equal(challengePoolForMode("masterThief").includes("quickAccess"), false);
  });

  it("draws challenges in order", () => {
    const first = drawNextChallenge("advanced", 0);
    assert.equal(first.id, "quickAccess");
    const second = drawNextChallenge("advanced", first.nextIndex);
    assert.equal(second.id, "noiseSensors");
  });

  it("maps active modifiers to public views", () => {
    const view = toModifierView({
      kind: "challenge",
      id: "hastyGetaway",
      permanent: true,
    });
    assert.equal(view.name, "Hasty Getaway");
    assert.equal(view.permanent, true);
  });
});
