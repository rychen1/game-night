import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameError } from "../Game.ts";
import { WavelengthGame } from "./WavelengthGame.ts";
import {
  asInternals,
  setRoundTarget,
  setSpectrum,
  setupFixedOrder,
} from "./testHelpers.ts";

const P1 = "p1";
const P2 = "p2";
const P3 = "p3";

function clueGiver(game: WavelengthGame): string {
  return game.getPublicState().clueGiverId;
}

function guessers(game: WavelengthGame): string[] {
  const giver = clueGiver(game);
  return asInternals(game).turnOrder.filter((id) => id !== giver);
}

function submitClue(game: WavelengthGame, clue = "Warm"): void {
  game.performAction(clueGiver(game), { type: "submit_clue", clue });
}

function submitAllGuesses(game: WavelengthGame, position = 50): void {
  for (const id of guessers(game)) {
    game.performAction(id, { type: "submit_spectrum_guess", position });
  }
}

describe("WavelengthGame setup", () => {
  it("requires at least 3 players", () => {
    const game = new WavelengthGame();
    assert.ok(game.canStart(2));
    assert.equal(game.canStart(3), null);
    assert.equal(game.canStart(10), null);
    assert.ok(game.canStart(11));
  });

  it("starts in CLUE with round 1 of N", () => {
    const game = new WavelengthGame();
    setupFixedOrder(game, [P1, P2, P3]);
    const state = game.getPublicState();
    assert.equal(state.phase, "CLUE");
    assert.equal(state.round, 1);
    assert.equal(state.totalRounds, 3);
    assert.equal(state.clueGiverId, P1);
    assert.ok(state.leftLabel.length > 0);
    assert.ok(state.rightLabel.length > 0);
    assert.equal(state.clue, null);
    assert.equal(state.totalScore, 0);
  });
});

describe("WavelengthGame hidden information", () => {
  it("gives the target only to the clue-giver privately", () => {
    const game = new WavelengthGame();
    setupFixedOrder(game, [P1, P2, P3]);
    setRoundTarget(game, 72);
    setSpectrum(game, "Hot", "Cold");

    const pub = game.getPublicState();
    assert.equal((pub as { target?: number }).target, undefined);

    const giverPrivate = game.getPrivateState(P1);
    assert.equal(giverPrivate.target, 72);

    const guesserPrivate = game.getPrivateState(P2);
    assert.equal(guesserPrivate.target, undefined);
  });

  it("does not expose guess positions in public state before reveal", () => {
    const game = new WavelengthGame();
    setupFixedOrder(game, [P1, P2, P3]);
    setRoundTarget(game, 40);
    submitClue(game);
    game.performAction(P2, { type: "submit_spectrum_guess", position: 55 });

    const pub = game.getPublicState();
    assert.deepEqual(pub.submittedGuesserIds, [P2]);
    assert.equal((pub as { guesses?: unknown }).guesses, undefined);
    assert.equal(game.getPrivateState(P2).myGuess, 55);
    assert.equal(game.getPrivateState(P3).myGuess, undefined);
  });
});

describe("WavelengthGame clues and guesses", () => {
  it("lets the clue-giver submit a clue", () => {
    const game = new WavelengthGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "submit_clue", clue: "Toasty" });
    assert.equal(game.getPublicState().phase, "GUESSING");
    assert.equal(game.getPublicState().clue, "Toasty");
  });

  it("rejects guesses before a clue exists", () => {
    const game = new WavelengthGame();
    setupFixedOrder(game, [P1, P2, P3]);
    assert.throws(
      () =>
        game.performAction(P2, { type: "submit_spectrum_guess", position: 50 }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "It is not time to guess",
    );
  });

  it("rejects guesses from the clue-giver", () => {
    const game = new WavelengthGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitClue(game);
    assert.throws(
      () =>
        game.performAction(P1, { type: "submit_spectrum_guess", position: 50 }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "The clue-giver cannot submit a guess",
    );
  });

  it("rejects duplicate guesses", () => {
    const game = new WavelengthGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitClue(game);
    game.performAction(P2, { type: "submit_spectrum_guess", position: 50 });
    assert.throws(
      () =>
        game.performAction(P2, { type: "submit_spectrum_guess", position: 60 }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "You already submitted a guess",
    );
  });

  it("rejects invalid guess positions", () => {
    const game = new WavelengthGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitClue(game);
    assert.throws(
      () =>
        game.performAction(P2, { type: "submit_spectrum_guess", position: 101 }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "Guess must be an integer from 0 to 100",
    );
  });
});

describe("WavelengthGame round flow", () => {
  it("reveals the target after all guesses are submitted", () => {
    const game = new WavelengthGame();
    setupFixedOrder(game, [P1, P2, P3]);
    setRoundTarget(game, 65);
    submitClue(game);
    submitAllGuesses(game, 65);

    const state = game.getPublicState();
    assert.equal(state.phase, "CLUE");
    assert.equal(state.round, 2);
    assert.ok(state.lastReveal);
    assert.equal(state.lastReveal?.target, 65);
    assert.equal(state.lastReveal?.guesses.length, 2);
  });

  it("calculates scores correctly", () => {
    const game = new WavelengthGame();
    setupFixedOrder(game, [P1, P2, P3]);
    setRoundTarget(game, 50);
    submitClue(game);
    game.performAction(P2, { type: "submit_spectrum_guess", position: 50 });
    game.performAction(P3, { type: "submit_spectrum_guess", position: 90 });

    const reveal = game.getPublicState().lastReveal;
    assert.equal(reveal?.guessScores[P2], 4);
    assert.equal(reveal?.guessScores[P3], 1);
    assert.equal(reveal?.roundScore, 5);
    assert.equal(game.getPublicState().totalScore, 5);
  });

  it("rotates the clue-giver each round", () => {
    const game = new WavelengthGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitClue(game);
    submitAllGuesses(game);
    assert.equal(game.getPublicState().clueGiverId, P2);

    submitClue(game);
    submitAllGuesses(game);
    assert.equal(game.getPublicState().clueGiverId, P3);
  });

  it("gives every player exactly one clue-giving turn", () => {
    const game = new WavelengthGame();
    setupFixedOrder(game, [P1, P2, P3]);
    const givers: string[] = [];
    for (let round = 0; round < 3; round += 1) {
      givers.push(clueGiver(game));
      submitClue(game);
      submitAllGuesses(game);
    }
    assert.deepEqual(givers, [P1, P2, P3]);
    assert.equal(game.getPublicState().phase, "RESULTS");
  });

  it("reaches RESULTS after the final round", () => {
    const game = new WavelengthGame();
    setupFixedOrder(game, [P1, P2, P3]);
    for (let round = 0; round < 3; round += 1) {
      submitClue(game);
      submitAllGuesses(game);
    }
    const results = game.getPublicState();
    assert.equal(results.phase, "RESULTS");
    assert.equal(results.history?.length, 3);
    assert.ok(results.history?.every((entry) => entry.target >= 0));
  });
});

describe("WavelengthGame replay", () => {
  it("setup creates fresh state for a new game", () => {
    const game = new WavelengthGame();
    setupFixedOrder(game, [P1, P2, P3]);
    setRoundTarget(game, 10);
    submitClue(game, "First");
    submitAllGuesses(game, 10);
    const firstScore = game.getPublicState().totalScore;

    game.setup([P1, P2, P3]);
    const fresh = game.getPublicState();
    assert.equal(fresh.phase, "CLUE");
    assert.equal(fresh.round, 1);
    assert.equal(fresh.clue, null);
    assert.equal(fresh.totalScore, 0);
    assert.equal(fresh.lastReveal, undefined);
    assert.equal(fresh.history, undefined);
    assert.notEqual(game.getPrivateState(fresh.clueGiverId).target, 10);
    assert.ok(firstScore >= 0);
  });
});
