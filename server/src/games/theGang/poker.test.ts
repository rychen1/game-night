import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { card } from "./testHelpers.ts";
import {
  compareEvaluatedHands,
  evaluateFive,
  evaluateSeven,
  handStrength,
} from "./poker.ts";

describe("The Gang poker evaluation", () => {
  it("ranks categories in standard order", () => {
    const pair = evaluateFive([
      card(14, "spades"),
      card(14, "hearts"),
      card(9, "clubs"),
      card(5, "diamonds"),
      card(2, "spades"),
    ]);
    const flush = evaluateFive([
      card(14, "spades"),
      card(10, "spades"),
      card(7, "spades"),
      card(4, "spades"),
      card(2, "spades"),
    ]);
    assert.equal(compareEvaluatedHands(flush, pair) > 0, true);
  });

  it("handles ace-low straights", () => {
    const wheel = evaluateFive([
      card(14, "hearts"),
      card(5, "clubs"),
      card(4, "diamonds"),
      card(3, "spades"),
      card(2, "hearts"),
    ]);
    assert.equal(wheel.category, "straight");
    assert.equal(wheel.ranks[0], 5);
  });

  it("uses kickers within the same category", () => {
    const pairAcesKing = evaluateFive([
      card(14, "spades"),
      card(14, "hearts"),
      card(13, "clubs"),
      card(5, "diamonds"),
      card(2, "spades"),
    ]);
    const pairAcesQueen = evaluateFive([
      card(14, "spades"),
      card(14, "hearts"),
      card(12, "clubs"),
      card(5, "diamonds"),
      card(2, "spades"),
    ]);
    assert.equal(compareEvaluatedHands(pairAcesKing, pairAcesQueen) > 0, true);
  });

  it("allows equal hands", () => {
    const handA = evaluateFive([
      card(14, "spades"),
      card(14, "hearts"),
      card(9, "clubs"),
      card(5, "diamonds"),
      card(2, "spades"),
    ]);
    const handB = evaluateFive([
      card(14, "diamonds"),
      card(14, "clubs"),
      card(9, "spades"),
      card(5, "hearts"),
      card(2, "clubs"),
    ]);
    assert.equal(compareEvaluatedHands(handA, handB), 0);
  });

  it("evaluates the best five from seven cards", () => {
    const best = evaluateSeven([
      card(14, "spades"),
      card(14, "hearts"),
      card(9, "clubs"),
      card(5, "diamonds"),
      card(2, "spades"),
      card(13, "clubs"),
      card(12, "diamonds"),
    ]);
    assert.equal(best.category, "pair");
    assert.equal(best.ranks[0], 14);
  });

  it("evaluates hold'em strength from hole and community cards", () => {
    const strength = handStrength(
      [card(14, "spades"), card(13, "spades")],
      [
        card(12, "spades"),
        card(11, "spades"),
        card(10, "spades"),
        card(2, "clubs"),
        card(3, "diamonds"),
      ],
    );
    assert.equal(strength.category, "straight_flush");
  });
});
