import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameError } from "../Game.ts";
import { PictionaryGame } from "./PictionaryGame.ts";
import {
  asInternals,
  setDeadline,
  setWord,
  setupFixedQueue,
  stroke,
} from "./testHelpers.ts";

const P1 = "p1";
const P2 = "p2";
const P3 = "p3";
const P4 = "p4";

describe("PictionaryGame setup", () => {
  it("requires at least 3 players", () => {
    const game = new PictionaryGame();
    assert.ok(game.canStart(2));
    assert.equal(game.canStart(3), null);
    assert.equal(game.canStart(10), null);
    assert.ok(game.canStart(11));
  });

  it("starts in DRAWING with the first queued drawer", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);

    const state = game.getPublicState();
    assert.equal(state.phase, "DRAWING");
    assert.equal(state.drawerId, P1);
    assert.equal(state.round, 1);
    assert.equal(state.totalRounds, 3);
    assert.equal(state.strokes.length, 0);
    assert.equal(state.guesses.length, 0);
    assert.equal(state.solved, false);
    assert.ok(state.endsAt);
  });

  it("gives the secret word only to the current drawer", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    setWord(game, "Castle");

    assert.equal(game.getPrivateState(P1).word, "Castle");
    assert.equal(game.getPrivateState(P2).word, undefined);
    assert.equal(game.getPrivateState(P3).word, undefined);
    assert.equal(game.getPrivateState(P1).role, "drawer");
    assert.equal(game.getPrivateState(P2).role, "guesser");
  });
});

describe("PictionaryGame information boundaries", () => {
  it("does not expose the secret word in public state during DRAWING", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    setWord(game, "Dragon");

    const pub = game.getPublicState() as Record<string, unknown>;
    assert.equal(pub.word, undefined);
    assert.equal(pub.history, undefined);
  });

  it("reveals completed words in RESULTS history only", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    setWord(game, "Castle");
    game.performAction(P1, { type: "submit_stroke", points: stroke() });
    game.performAction(P2, { type: "submit_guess", text: "Castle" });

    while (game.getPublicState().phase === "DRAWING") {
      const drawer = game.getPublicState().drawerId!;
      setWord(game, "Dragon");
      game.performAction(drawer, { type: "submit_stroke", points: stroke() });
      const guesser = [P1, P2, P3].find((id) => id !== drawer)!;
      game.performAction(guesser, { type: "submit_guess", text: "Dragon" });
    }

    const results = game.getPublicState();
    assert.equal(results.phase, "RESULTS");
    assert.ok(results.history);
    assert.equal(results.history!.length, 3);
    assert.ok(results.history!.every((round) => round.word.length > 0));
  });

  it("publishes lastRound with the solved word between rounds", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    setWord(game, "Castle");
    game.performAction(P2, { type: "submit_guess", text: "castle" });

    const state = game.getPublicState();
    assert.equal(state.phase, "DRAWING");
    assert.equal(state.lastRound?.word, "Castle");
    assert.equal(state.lastRound?.solverId, P2);
    assert.equal(state.drawerId, P2);
  });
});

describe("PictionaryGame drawing", () => {
  it("accepts strokes from the drawer and updates public strokes", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);

    game.performAction(P1, {
      type: "submit_stroke",
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.3, y: 0.4 },
      ],
    });

    assert.equal(game.getPublicState().strokes.length, 1);
    assert.equal(game.getPublicState().strokes[0]?.playerId, P1);
    assert.equal(game.getPublicState().strokes[0]?.points.length, 2);
  });

  it("rejects strokes from non-drawers", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);

    assert.throws(
      () => game.performAction(P2, { type: "submit_stroke", points: stroke() }),
      (error: unknown) =>
        error instanceof GameError && error.message === "Only the drawer can draw",
    );
  });

  it("rejects overly long strokes", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    const points = Array.from({ length: 501 }, (_, index) => ({
      x: index / 500,
      y: 0.5,
    }));

    assert.throws(
      () => game.performAction(P1, { type: "submit_stroke", points }),
      (error: unknown) =>
        error instanceof GameError && error.message === "Stroke is too long",
    );
  });

  it("rejects drawing after the game ends", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    asInternals(game).phase = "RESULTS";

    assert.throws(
      () => game.performAction(P1, { type: "submit_stroke", points: stroke() }),
      (error: unknown) =>
        error instanceof GameError && error.message === "The game is over",
    );
  });
});

describe("PictionaryGame guessing", () => {
  it("accepts case-insensitive correct guesses and completes the round once", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    setWord(game, "Apple");
    game.performAction(P1, { type: "submit_stroke", points: stroke() });

    game.performAction(P3, { type: "submit_guess", text: "  APPLE  " });

    const state = game.getPublicState();
    assert.equal(state.phase, "DRAWING");
    assert.equal(state.drawerId, P2);
    assert.equal(state.round, 2);
    assert.equal(state.strokes.length, 0);
    assert.equal(state.guesses.length, 0);
    assert.equal(asInternals(game).history.length, 1);
    assert.equal(
      (asInternals(game).history[0] as { solverId: string }).solverId,
      P3,
    );
  });

  it("rejects guesses from the drawer", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    setWord(game, "Apple");

    assert.throws(
      () => game.performAction(P1, { type: "submit_guess", text: "Apple" }),
      (error: unknown) =>
        error instanceof GameError && error.message === "The drawer cannot guess",
    );
  });

  it("records incorrect guesses without advancing the round", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    setWord(game, "Apple");

    game.performAction(P2, { type: "submit_guess", text: "Banana" });

    const state = game.getPublicState();
    assert.equal(state.drawerId, P1);
    assert.equal(state.guesses.length, 1);
    assert.equal(state.guesses[0]?.correct, false);
    assert.equal(asInternals(game).history.length, 0);
  });

  it("creates one history entry per solved round", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    setWord(game, "Apple");

    game.performAction(P2, { type: "submit_guess", text: "Apple" });
    assert.equal(asInternals(game).history.length, 1);

    setWord(game, "Bicycle");
    game.performAction(P3, { type: "submit_guess", text: "Wrong" });
    assert.equal(asInternals(game).history.length, 1);
  });

  it("rejects empty guesses", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);

    assert.throws(
      () => game.performAction(P2, { type: "submit_guess", text: "   " }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "Guess must be 1–40 characters",
    );
  });
});

describe("PictionaryGame timer and round transitions", () => {
  it("skips an unsolved drawer when the timer expires", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    setWord(game, "Castle");
    setDeadline(game, Date.now() - 1);

    game.onTimer();

    const state = game.getPublicState();
    assert.equal(state.phase, "DRAWING");
    assert.equal(state.drawerId, P2);
    assert.equal(state.round, 2);
    assert.equal(state.strokes.length, 0);
    assert.equal(state.guesses.length, 0);
    assert.equal(asInternals(game).history.length, 1);
    assert.equal(asInternals(game).history[0]?.drawerId, P1);
    assert.equal(asInternals(game).history[0]?.skipped, true);
    assert.ok(state.endsAt);
  });

  it("does not double-advance when onTimer is called with a stale deadline", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    const future = Date.now() + 60_000;
    setDeadline(game, future);

    game.onTimer();

    assert.equal(game.getPublicState().drawerId, P1);
    assert.equal(asInternals(game).remainingToDraw.length, 3);
  });

  it("enters RESULTS after the final drawer times out unsolved", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    asInternals(game).remainingToDraw = [P3];
    asInternals(game).drawn = new Set([P1, P2]);
    setDeadline(game, Date.now() - 1);

    game.onTimer();

    assert.equal(game.getPublicState().phase, "RESULTS");
    assert.equal(game.getPublicState().endsAt, undefined);
    assert.equal(asInternals(game).history.length, 1);
    assert.equal(asInternals(game).history[0]?.drawerId, P3);
    assert.equal(asInternals(game).history[0]?.skipped, true);
  });

  it("includes skipped turns in RESULTS history for the postgame gallery", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    setWord(game, "Castle");
    game.performAction(P2, { type: "submit_guess", text: "Castle" });

    setDeadline(game, Date.now() - 1);
    game.onTimer();

    setWord(game, "Dragon");
    game.performAction(P1, { type: "submit_guess", text: "Dragon" });

    const results = game.getPublicState();
    assert.equal(results.phase, "RESULTS");
    assert.equal(results.history?.length, 3);
    assert.equal(results.history?.[0]?.drawerId, P1);
    assert.notEqual(results.history?.[0]?.skipped, true);
    assert.equal(results.history?.[1]?.drawerId, P2);
    assert.equal(results.history?.[1]?.skipped, true);
    assert.equal(results.history?.[1]?.strokes.length, 0);
    assert.equal(results.history?.[2]?.drawerId, P3);
    assert.notEqual(results.history?.[2]?.skipped, true);
  });

  it("enters RESULTS after the final correct guess", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    asInternals(game).remainingToDraw = [P3];
    asInternals(game).drawn = new Set([P1, P2]);
    setWord(game, "Volcano");

    game.performAction(P1, { type: "submit_guess", text: "Volcano" });

    assert.equal(game.getPublicState().phase, "RESULTS");
    assert.equal(asInternals(game).history.length, 1);
  });
});

describe("PictionaryGame termination and adversarial cases", () => {
  it("rejects actions after RESULTS", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    asInternals(game).phase = "RESULTS";

    assert.throws(
      () => game.performAction(P2, { type: "submit_guess", text: "Apple" }),
      (error: unknown) =>
        error instanceof GameError && error.message === "The game is over",
    );
  });

  it("aborts when fewer than 3 active players remain", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    game.onPlayerRemoved(P3);

    assert.equal(game.getPublicState().phase, "ABORTED");
    assert.equal(game.isGameOver(), true);
  });

  it("skips to the next drawer when the current drawer leaves", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3, P4]);
    setWord(game, "Castle");
    game.performAction(P1, { type: "submit_stroke", points: stroke() });

    game.onPlayerRemoved(P1);

    const state = game.getPublicState();
    assert.equal(state.phase, "DRAWING");
    assert.equal(state.drawerId, P2);
    assert.equal(state.strokes.length, 0);
    assert.equal(state.guesses.length, 0);
    assert.equal(asInternals(game).active.size, 3);
  });

  it("continues when a non-drawer leaves and removes them from the rotation", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3, P4]);
    game.onPlayerRemoved(P4);

    assert.equal(game.getPublicState().phase, "DRAWING");
    assert.equal(game.getPublicState().totalRounds, 3);
    assert.deepEqual([...asInternals(game).remainingToDraw], [P1, P2, P3]);
    assert.equal(asInternals(game).active.size, 3);
  });

  it("does not expose the next word to guessers after reconnect-style state read", () => {
    const game = new PictionaryGame();
    setupFixedQueue(game, [P1, P2, P3]);
    setWord(game, "Secret");

    assert.equal(game.getPrivateState(P2).word, undefined);
    assert.equal(game.getPrivateState(P1).word, "Secret");
  });
});
