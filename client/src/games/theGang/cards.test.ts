import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cardLabel, rankLabel, suitSymbol } from "./cards.ts";

describe("The Gang card labels", () => {
  it("formats ranks and suits", () => {
    assert.equal(rankLabel(14), "A");
    assert.equal(rankLabel(11), "J");
    assert.equal(suitSymbol("hearts"), "♥");
    assert.equal(
      cardLabel({ rank: 14, suit: "spades" }),
      "A♠",
    );
  });
});
