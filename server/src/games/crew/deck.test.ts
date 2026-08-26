import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildShuffledDeck,
  handSizesFor,
  totalDealtCards,
  trickWinnerIndex,
} from "./deck.ts";
import { buildOrderedDeck, card } from "./testHelpers.ts";

describe("Crew deck", () => {
  it("builds a 40-card deck with unique card IDs", () => {
    const deck = buildOrderedDeck();
    assert.equal(deck.length, 40);
    assert.equal(new Set(deck.map((entry) => entry.cardId)).size, 40);
  });

  it("assigns official Deep Sea deal sizes for 2/3/4/5 players", () => {
    assert.deepEqual(handSizesFor(2), [10, 10]);
    assert.deepEqual(handSizesFor(3), [14, 13, 13]);
    assert.deepEqual(handSizesFor(4), [10, 10, 10, 10]);
    assert.deepEqual(handSizesFor(5), [8, 8, 8, 8, 8]);
    assert.equal(totalDealtCards(2), 20);
    assert.equal(totalDealtCards(3), 40);
    assert.equal(totalDealtCards(4), 40);
    assert.equal(totalDealtCards(5), 40);
  });

  it("shuffled deck preserves 40 unique cards", () => {
    const deck = buildShuffledDeck();
    assert.equal(deck.length, 40);
    assert.equal(new Set(deck.map((entry) => entry.cardId)).size, 40);
  });
});

describe("trickWinnerIndex", () => {
  it("awards the trick to the highest card of the led suit", () => {
    const winner = trickWinnerIndex([
      { card: card("a", "blue", 2) },
      { card: card("b", "blue", 9) },
    ]);
    assert.equal(winner, 1);
  });

  it("awards the trick to the first card when it is highest of the led suit", () => {
    const winner = trickWinnerIndex([
      { card: card("a", "green", 8) },
      { card: card("b", "green", 3) },
    ]);
    assert.equal(winner, 0);
  });

  it("allows trump to beat a higher led-suit card", () => {
    const winner = trickWinnerIndex([
      { card: card("a", "red", 9) },
      { card: card("b", "submarine", 1) },
    ]);
    assert.equal(winner, 1);
  });

  it("chooses the higher trump when both players trump", () => {
    const winner = trickWinnerIndex([
      { card: card("a", "submarine", 2) },
      { card: card("b", "submarine", 4) },
    ]);
    assert.equal(winner, 1);
  });

  it("does not let an off-suit non-trump card win over the led suit", () => {
    const winner = trickWinnerIndex([
      { card: card("a", "yellow", 5) },
      { card: card("b", "red", 9) },
    ]);
    assert.equal(winner, 0);
  });

  it("does not let a lower trump lose to a higher led-suit card when trump was not led", () => {
    const winner = trickWinnerIndex([
      { card: card("a", "blue", 9) },
      { card: card("b", "submarine", 1) },
    ]);
    assert.equal(winner, 1);
  });
});
