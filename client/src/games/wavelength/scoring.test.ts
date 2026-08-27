import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { guessScore, scoreGuess, scoreRound } from "./scoring.ts";

describe("wavelength scoring", () => {
  it("maps distance bands to points", () => {
    assert.equal(guessScore(0), 4);
    assert.equal(guessScore(10), 4);
    assert.equal(guessScore(11), 3);
    assert.equal(guessScore(20), 3);
    assert.equal(guessScore(21), 2);
    assert.equal(guessScore(30), 2);
    assert.equal(guessScore(31), 1);
    assert.equal(guessScore(40), 1);
    assert.equal(guessScore(41), 0);
  });

  it("scores a round as the sum of guess scores", () => {
    const result = scoreRound(50, [
      { playerId: "a", position: 50 },
      { playerId: "b", position: 80 },
    ]);
    assert.equal(scoreGuess(50, 50), 4);
    assert.equal(result.guessScores.a, 4);
    assert.equal(result.guessScores.b, 2);
    assert.equal(result.roundScore, 6);
  });
});
