import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameError } from "../Game.ts";
import { TelestrationsGame } from "./TelestrationsGame.ts";
import {
  asInternals,
  completeGame,
  contributionRoundCount,
  expectedBookPageCount,
  ownerIdFor,
  playerIds,
  setDeadline,
  setupFixedOrder,
  stroke,
  submitAllInPhase,
  submitDrawing,
  submitGuess,
} from "./testHelpers.ts";

const P1 = "p1";
const P2 = "p2";
const P3 = "p3";
const P4 = "p4";

describe("TelestrationsGame setup", () => {
  it("requires 3 to 10 players", () => {
    const game = new TelestrationsGame();
    assert.ok(game.canStart(2));
    assert.equal(game.canStart(3), null);
    assert.equal(game.canStart(10), null);
    assert.ok(game.canStart(11));
  });

  it("starts in DRAWING round 0 with one prompt page per book", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3], ["Alpha", "Beta", "Gamma"]);

    const state = game.getPublicState();
    assert.equal(state.phase, "DRAWING");
    assert.equal(state.round, 0);
    assert.equal(state.totalRounds, contributionRoundCount(3));
    assert.deepEqual(state.playerOrder, [P1, P2, P3]);
    assert.deepEqual(state.submittedPlayerIds, []);
    assert.equal(state.books, undefined);
    assert.ok(state.endsAt);

    const books = asInternals(game).books;
    assert.equal(books.size, 3);
    const firstPage = books.get(P1)?.[0];
    assert.equal(firstPage?.kind, "prompt");
    if (firstPage?.kind === "prompt") {
      assert.equal(firstPage.text, "Alpha");
    }
  });

  it("gives each player their own prompt only in private draw state", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3], ["Alpha", "Beta", "Gamma"]);

    assert.equal(game.getPrivateState(P1).task, "draw");
    assert.equal(game.getPrivateState(P1).promptText, "Alpha");
    assert.equal(game.getPrivateState(P2).promptText, "Beta");
    assert.equal(game.getPrivateState(P3).promptText, "Gamma");
    assert.equal(game.getPrivateState(P1).guessText, undefined);
    assert.equal(game.getPrivateState(P1).strokes, undefined);
  });
});

describe("TelestrationsGame information boundaries", () => {
  it("does not expose books or prompts in public state before REVEAL", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitDrawing(game, P1);

    const pub = game.getPublicState() as Record<string, unknown>;
    assert.equal(pub.books, undefined);
    assert.equal(pub.promptText, undefined);
  });

  it("does not expose another player's prompt through private projection", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3], ["Alpha", "Beta", "Gamma"]);

    assert.equal(game.getPrivateState(P1).promptText, "Alpha");
    assert.equal(game.getPrivateState(P2).promptText, "Beta");
    assert.notEqual(game.getPrivateState(P1).promptText, "Beta");
  });

  it("reveals full books only in REVEAL", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    completeGame(game, [P1, P2, P3]);

    const state = game.getPublicState();
    assert.equal(state.phase, "REVEAL");
    assert.ok(state.books);
    assert.equal(state.books!.length, 3);
    assert.equal(game.getPrivateState(P1).task, "reveal");
  });

  it("does not publish books on ABORTED", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.onPlayerRemoved(P2);

    assert.equal(game.getPublicState().phase, "ABORTED");
    assert.equal(game.getPublicState().books, undefined);
  });
});

describe("TelestrationsGame chain and rotation", () => {
  it("assigns exactly one book per player that stays with the owner", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);

    assert.equal(asInternals(game).books.size, 3);
    assert.ok(asInternals(game).books.has(P1));
    assert.ok(asInternals(game).books.has(P2));
    assert.ok(asInternals(game).books.has(P3));
  });

  it("delivers the correct preceding entry for a 3-player chain", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3], ["A", "B", "C"]);

    submitAllInPhase(game, [P1, P2, P3]);
    assert.equal(game.getPublicState().phase, "GUESSING");

    assert.equal(game.getPrivateState(P1).task, "guess");
    assert.equal(game.getPrivateState(P1).strokes?.[0]?.playerId, P3);
    assert.equal(game.getPrivateState(P2).strokes?.[0]?.playerId, P1);
    assert.equal(game.getPrivateState(P3).strokes?.[0]?.playerId, P2);

    submitGuess(game, P1, "guess-from-p1");
    submitGuess(game, P2, "guess-from-p2");
    submitGuess(game, P3, "guess-from-p3");

    assert.equal(game.getPublicState().phase, "DRAWING");
    assert.equal(game.getPrivateState(P1).task, "draw");
    assert.equal(game.getPrivateState(P1).guessText, "guess-from-p3");
    assert.equal(game.getPrivateState(P2).guessText, "guess-from-p1");
    assert.equal(game.getPrivateState(P3).guessText, "guess-from-p2");
  });

  it("never returns a player to their own prompt before REVEAL", () => {
    const ids = [P1, P2, P3, P4];
    const game = new TelestrationsGame();
    setupFixedOrder(game, ids);

    submitAllInPhase(game, ids);
    for (let round = 1; round < contributionRoundCount(ids.length); round += 1) {
      for (const id of ids) {
        assert.notEqual(ownerIdFor(ids, id, round), id);
        const privateState = game.getPrivateState(id);
        if (privateState.task === "draw") {
          assert.equal(privateState.promptText, undefined);
        }
      }
      submitAllInPhase(game, ids);
    }
    assert.equal(game.getPublicState().phase, "REVEAL");
  });

  it("builds alternating pages with correct authorship for 3 players", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3], ["A", "B", "C"]);

    submitDrawing(game, P1, [{ playerId: P1, points: [{ x: 0.1, y: 0.2 }] }]);
    submitDrawing(game, P2, [{ playerId: P2, points: [{ x: 0.2, y: 0.3 }] }]);
    submitDrawing(game, P3, [{ playerId: P3, points: [{ x: 0.3, y: 0.4 }] }]);

    submitGuess(game, P1, "g1");
    submitGuess(game, P2, "g2");
    submitGuess(game, P3, "g3");

    submitDrawing(game, P1, [{ playerId: P1, points: [{ x: 0.4, y: 0.5 }] }]);
    submitDrawing(game, P2, [{ playerId: P2, points: [{ x: 0.5, y: 0.6 }] }]);
    submitDrawing(game, P3, [{ playerId: P3, points: [{ x: 0.6, y: 0.7 }] }]);

    submitGuess(game, P1, "g4");
    submitGuess(game, P2, "g5");
    submitGuess(game, P3, "g6");

    const books = game.getPublicState().books!;
    const book1 = books.find((book) => book.ownerId === P1)!;
    assert.deepEqual(
      book1.pages.map((page) => [page.kind, page.authorId]),
      [
        ["prompt", P1],
        ["drawing", P1],
        ["guess", P2],
        ["drawing", P3],
        ["guess", P1],
      ],
    );
  });

  it("builds a complete chain for 4 players ending on a guess", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3, P4]);
    completeGame(game, [P1, P2, P3, P4]);

    const book2 = game.getPublicState().books!.find((book) => book.ownerId === P2)!;
    assert.equal(book2.pages.length, 5);
    assert.deepEqual(
      book2.pages.map((page) => page.kind),
      ["prompt", "drawing", "guess", "drawing", "guess"],
    );
  });

  for (let count = 3; count <= 6; count += 1) {
    it(`${count} players produce ${expectedBookPageCount(count)} pages per book after completion`, () => {
      const ids = playerIds(count);
      const game = new TelestrationsGame();
      setupFixedOrder(game, ids);
      completeGame(game, ids);

      for (const id of ids) {
        const book = game.getPublicState().books!.find((entry) => entry.ownerId === id)!;
        assert.equal(book.pages.length, expectedBookPageCount(count));
        assert.equal(book.pages[0]?.kind, "prompt");
        assert.equal(book.pages[0]?.authorId, id);
        assert.equal(book.pages.at(-1)?.kind, "guess");
      }
    });
  }

  for (const count of [5, 7]) {
    it(`${count} players end every book on a guess`, () => {
      const ids = playerIds(count);
      const game = new TelestrationsGame();
      setupFixedOrder(game, ids);
      completeGame(game, ids);

      assert.equal(game.getPublicState().phase, "REVEAL");
      assert.equal(game.getPublicState().totalRounds, contributionRoundCount(count));
      for (const id of ids) {
        const book = game.getPublicState().books!.find((entry) => entry.ownerId === id)!;
        assert.equal(book.pages.at(-1)?.kind, "guess");
      }
    });
  }
});

describe("TelestrationsGame drawing", () => {
  it("accepts a drawing from any player during DRAWING", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);

    submitDrawing(game, P2);

    assert.deepEqual(game.getPublicState().submittedPlayerIds, [P2]);
    assert.equal(asInternals(game).books.get(P2)?.length, 2);
  });

  it("rejects duplicate drawing submissions", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitDrawing(game, P1);

    assert.throws(
      () => submitDrawing(game, P1),
      (error: unknown) =>
        error instanceof GameError && error.message === "You have already submitted",
    );
  });

  it("rejects drawing during GUESSING", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);

    assert.throws(
      () => submitDrawing(game, P1),
      (error: unknown) =>
        error instanceof GameError && error.message === "It is not time to draw",
    );
  });

  it("stores strokes on the rotated owner book, not always the submitter book", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);

    submitDrawing(game, P1);

    assert.equal(asInternals(game).books.get(P1)?.length, 3);
    assert.equal(asInternals(game).books.get(P2)?.length, 4);
    assert.equal(asInternals(game).books.get(P2)?.[3]?.kind, "drawing");
    assert.equal(asInternals(game).books.get(P2)?.[3]?.authorId, P1);
  });

  it("rejects actions from players not in the game", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);

    assert.throws(
      () => submitDrawing(game, "missing"),
      (error: unknown) =>
        error instanceof GameError && error.message === "You are not in this game",
    );
  });
});

describe("TelestrationsGame guessing", () => {
  it("accepts guesses during GUESSING and normalizes trim", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);

    submitGuess(game, P1, "  robot  ");

    const owner = ownerIdFor([P1, P2, P3], P1, 1);
    const guessPage = asInternals(game).books.get(owner)?.at(-1);
    assert.equal(guessPage?.kind, "guess");
    if (guessPage?.kind === "guess") {
      assert.equal(guessPage.text, "robot");
    }
  });

  it("rejects empty and oversized guesses", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);

    assert.throws(
      () => submitGuess(game, P1, "   "),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "Guess must be 1–40 characters",
    );
    assert.throws(
      () => submitGuess(game, P1, "x".repeat(41)),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "Guess must be 1–40 characters",
    );
  });

  it("rejects duplicate guess submissions", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);
    submitGuess(game, P1, "one");

    assert.throws(
      () => submitGuess(game, P1, "two"),
      (error: unknown) =>
        error instanceof GameError && error.message === "You have already submitted",
    );
  });

  it("rejects guessing during DRAWING", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);

    assert.throws(
      () => submitGuess(game, P1, "early"),
      (error: unknown) =>
        error instanceof GameError && error.message === "It is not time to guess",
    );
  });
});

describe("TelestrationsGame turn progression", () => {
  it("waits for all players before advancing the round", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitDrawing(game, P1);
    submitDrawing(game, P2);

    assert.equal(game.getPublicState().phase, "DRAWING");
    assert.equal(game.getPublicState().round, 0);

    submitDrawing(game, P3);
    assert.equal(game.getPublicState().phase, "GUESSING");
    assert.equal(game.getPublicState().round, 1);
    assert.deepEqual(game.getPublicState().submittedPlayerIds, []);
  });

  it("enters REVEAL after the final round without an extra turn", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    completeGame(game, [P1, P2, P3]);

    assert.equal(game.getPublicState().phase, "REVEAL");
    assert.equal(game.getPublicState().round, contributionRoundCount(3));
    assert.equal(game.isGameOver(), true);
  });

  it("rejects actions after REVEAL", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    completeGame(game, [P1, P2, P3]);

    assert.throws(
      () => submitDrawing(game, P1),
      (error: unknown) =>
        error instanceof GameError && error.message === "The round is over",
    );
    assert.throws(
      () => submitGuess(game, P1, "late"),
      (error: unknown) =>
        error instanceof GameError && error.message === "The round is over",
    );
  });
});

describe("TelestrationsGame timers", () => {
  it("does not advance on a stale timer deadline", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    setDeadline(game, Date.now() + 60_000);

    game.onTimer();

    assert.equal(game.getPublicState().phase, "DRAWING");
    assert.equal(game.getPublicState().round, 0);
  });

  it("auto-completes missing submissions and advances once on expiry", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitDrawing(game, P1);
    submitDrawing(game, P2);
    setDeadline(game, Date.now() - 1);

    game.onTimer();

    assert.equal(game.getPublicState().phase, "GUESSING");
    assert.equal(game.getPublicState().round, 1);
    const owner = ownerIdFor([P1, P2, P3], P3, 0);
    const page = asInternals(game).books.get(owner)?.at(-1);
    assert.equal(page?.kind, "drawing");
    if (page?.kind === "drawing") {
      assert.deepEqual(page.strokes, []);
    }
  });

  it("uses (timed out) for missing guesses on expiry", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);
    submitGuess(game, P1, "done");
    setDeadline(game, Date.now() - 1);

    game.onTimer();

    assert.equal(game.getPublicState().phase, "DRAWING");
    assert.equal(game.getPublicState().round, 2);
    const owner = ownerIdFor([P1, P2, P3], P2, 1);
    const page = asInternals(game).books.get(owner)?.at(-1);
    assert.equal(page?.kind, "guess");
    if (page?.kind === "guess") {
      assert.equal(page.text, "(timed out)");
    }
  });

  it("does not advance the next phase when onTimer fires with a still-future deadline", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);
    setDeadline(game, Date.now() + 60_000);

    game.onTimer();

    assert.equal(game.getPublicState().phase, "GUESSING");
    assert.equal(game.getPublicState().round, 1);
  });
});

describe("TelestrationsGame leave and abort", () => {
  it("aborts immediately when any player leaves", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3, P4]);
    submitDrawing(game, P1);
    game.onPlayerRemoved(P4);

    assert.equal(game.getPublicState().phase, "ABORTED");
    assert.equal(game.getPublicState().books, undefined);
    assert.equal(game.isGameOver(), true);
  });

  it("rejects further actions after abort", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.onPlayerRemoved(P1);

    assert.throws(
      () => submitDrawing(game, P2),
      (error: unknown) =>
        error instanceof GameError && error.message === "The round is over",
    );
  });
});

describe("TelestrationsGame adversarial", () => {
  it("binds authorship to the authenticated player for drawings and guesses", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitDrawing(game, P1);
    submitAllInPhase(game, [P2, P3]);
    submitGuess(game, P1, "mine");

    const owner = ownerIdFor([P1, P2, P3], P1, 1);
    const guessPage = asInternals(game).books.get(owner)?.at(-1);
    assert.equal(guessPage?.kind, "guess");
    if (guessPage?.kind === "guess") {
      assert.equal(guessPage.authorId, P1);
    }
  });

  it("rejects stale drawing submissions after the phase advances", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);

    assert.throws(
      () => submitDrawing(game, P2),
      (error: unknown) =>
        error instanceof GameError && error.message === "It is not time to draw",
    );
  });

  it("rejects stale guess submissions after REVEAL", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    completeGame(game, [P1, P2, P3]);

    assert.throws(
      () => submitGuess(game, P1, "late"),
      (error: unknown) =>
        error instanceof GameError && error.message === "The round is over",
    );
  });

  it("does not add pages when onTimer fires with a future deadline after manual completion", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitDrawing(game, P1);
    submitDrawing(game, P2);
    submitDrawing(game, P3);
    setDeadline(game, Date.now() + 60_000);
    game.onTimer();

    for (const id of [P1, P2, P3]) {
      assert.equal(asInternals(game).books.get(id)?.length, 2);
    }
    assert.equal(game.getPublicState().phase, "GUESSING");
  });
});

describe("TelestrationsGame reconnect-style projections", () => {
  it("preserves per-player private task and hides other books mid-game", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3], ["A", "B", "C"]);
    submitAllInPhase(game, [P1, P2, P3]);

    const p1 = game.getPrivateState(P1);
    const p2 = game.getPrivateState(P2);
    assert.equal(p1.task, "guess");
    assert.equal(p2.task, "guess");
    assert.ok(p1.strokes);
    assert.ok(p2.strokes);
    assert.notDeepEqual(p1.strokes, p2.strokes);
    assert.equal(game.getPublicState().books, undefined);
  });

  it("restores endsAt through public state during timed phases", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    const endsAt = game.getPublicState().endsAt;
    assert.ok(endsAt);
    assert.equal(game.getTimerDeadline(), endsAt);
  });
});
