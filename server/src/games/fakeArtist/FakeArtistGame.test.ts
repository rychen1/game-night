import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameError } from "../Game.ts";
import { FakeArtistGame } from "./FakeArtistGame.ts";
import {
  asInternals,
  assertNoSecretLeakDuringPlay,
  castVote,
  completeDrawing,
  playerIds,
  setDeadline,
  setFakeArtist,
  setWord,
  setupFixedOrder,
  stroke,
} from "./testHelpers.ts";

const P1 = "p1";
const P2 = "p2";
const P3 = "p3";
const P4 = "p4";

describe("FakeArtistGame setup", () => {
  it("requires 3 to 10 players", () => {
    const game = new FakeArtistGame();
    assert.ok(game.canStart(2));
    assert.equal(game.canStart(3), null);
    assert.equal(game.canStart(10), null);
    assert.ok(game.canStart(11));
  });

  it("starts in DRAWING with category public and two drawing passes queued", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);

    const state = game.getPublicState();
    assert.equal(state.phase, "DRAWING");
    assert.equal(state.category, "Food");
    assert.equal(state.currentPlayerId, P1);
    assert.equal(state.round, 1);
    assert.deepEqual(state.turnOrder, [P1, P2, P3]);
    assert.equal(asInternals(game).turnQueue.length, 6);
    assert.ok(state.endsAt);
    assert.equal(state.fakeArtistId, undefined);
    assert.equal(state.word, undefined);
  });

  it("assigns the secret word to artists but not the Fake Artist", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);

    assert.equal(game.getPrivateState(P1).word, "Pizza");
    assert.equal(game.getPrivateState(P3).word, "Pizza");
    assert.equal(game.getPrivateState(P2).word, undefined);
    assert.equal(game.getPrivateState(P2).role, "fakeArtist");
    assert.equal(game.getPrivateState(P1).role, "artist");
  });
});

describe("FakeArtistGame hidden information", () => {
  it("does not expose the secret word or Fake Artist identity during play", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);

    const pub = game.getPublicState();
    assert.equal(pub.word, undefined);
    assert.equal(pub.fakeArtistId, undefined);
    assert.equal(pub.votes, undefined);
  });

  it("reveals word, Fake Artist, and votes only in RESULTS", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);
    castVote(game, P1, P2);
    castVote(game, P2, P1);
    castVote(game, P3, P2);
    game.performAction(P2, { type: "guess_word", word: "wrong" });

    const state = game.getPublicState();
    assert.equal(state.phase, "RESULTS");
    assert.equal(state.word, "Pizza");
    assert.equal(state.fakeArtistId, P2);
    assert.ok(state.votes);
    assert.equal(state.winner, "fakeArtist");
  });

  it("does not leak another player's private word through projection", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);

    assert.equal(game.getPrivateState(P1).word, "Pizza");
    assert.equal(game.getPrivateState(P2).word, undefined);
    assert.equal(game.getPrivateState(P3).word, "Pizza");
  });
});

describe("FakeArtistGame drawing", () => {
  it("accepts one stroke from the current player and advances turn order", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);

    game.performAction(P1, { type: "submit_stroke", points: stroke() });

    assert.equal(game.getPublicState().strokes.length, 1);
    assert.equal(game.getPublicState().currentPlayerId, P2);
    assert.equal(game.getPublicState().round, 1);
  });

  it("rejects strokes from the wrong player", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);

    assert.throws(
      () => game.performAction(P2, { type: "submit_stroke", points: stroke() }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "It is not your turn to draw",
    );
  });

  it("rejects a second stroke from the same player in one turn", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    game.performAction(P1, { type: "submit_stroke", points: stroke() });

    assert.throws(
      () => game.performAction(P1, { type: "submit_stroke", points: stroke() }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "It is not your turn to draw",
    );
  });

  it("includes the Fake Artist in the drawing rotation", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);

    game.performAction(P1, { type: "submit_stroke", points: stroke() });
    game.performAction(P2, { type: "submit_stroke", points: stroke() });

    assert.equal(
      game.getPublicState().strokes.some((s) => s.playerId === P2),
      true,
    );
  });

  it("enters VOTING after the final drawing turn", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);

    assert.equal(game.getPublicState().phase, "VOTING");
    assert.equal(game.getPublicState().currentPlayerId, null);
    assert.equal(game.getPublicState().endsAt, undefined);
  });

  it("rejects drawing after entering VOTING", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);

    assert.throws(
      () => game.performAction(P1, { type: "submit_stroke", points: stroke() }),
      (error: unknown) =>
        error instanceof GameError && error.message === "It is not time to draw",
    );
  });

  it("rejects overly long strokes", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
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
});

describe("FakeArtistGame drawing timer", () => {
  it("skips a turn when the drawing timer expires", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    setDeadline(game, Date.now() - 1);

    game.onTimer();

    assert.equal(game.getPublicState().currentPlayerId, P2);
    assert.equal(game.getPublicState().strokes.length, 0);
  });

  it("does not double-advance when onTimer is called with a stale deadline", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    setDeadline(game, Date.now() + 60_000);

    game.onTimer();

    assert.equal(game.getPublicState().currentPlayerId, P1);
    assert.equal(asInternals(game).turnIndex, 0);
  });

  it("enters VOTING when the final drawing timer expires", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    asInternals(game).turnIndex = 5;
    setDeadline(game, Date.now() - 1);

    game.onTimer();

    assert.equal(game.getPublicState().phase, "VOTING");
  });
});

describe("FakeArtistGame voting", () => {
  it("accepts valid votes and tracks voted players without revealing targets", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);

    castVote(game, P1, P2);

    const state = game.getPublicState();
    assert.equal(state.phase, "VOTING");
    assert.deepEqual(state.votedPlayerIds, [P1]);
    assert.equal(state.votes, undefined);
  });

  it("rejects self-votes", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);

    assert.throws(
      () => castVote(game, P1, P1),
      (error: unknown) =>
        error instanceof GameError && error.message === "You cannot vote for yourself",
    );
  });

  it("rejects duplicate votes", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);
    castVote(game, P1, P2);

    assert.throws(
      () => castVote(game, P1, P3),
      (error: unknown) =>
        error instanceof GameError && error.message === "You have already voted",
    );
  });

  it("rejects votes for players not in the game", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);

    assert.throws(
      () => castVote(game, P1, "missing"),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "That player is not in the game",
    );
  });

  it("rejects voting outside VOTING", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);

    assert.throws(
      () => castVote(game, P1, P2),
      (error: unknown) =>
        error instanceof GameError && error.message === "It is not time to vote",
    );
  });
});

describe("FakeArtistGame identification and guess", () => {
  it("enters GUESS when the Fake Artist is the unique top vote", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);
    castVote(game, P1, P2);
    castVote(game, P2, P1);
    castVote(game, P3, P2);

    assert.equal(game.getPublicState().phase, "GUESS");
    assert.deepEqual(game.getPrivateState(P2).legalActions, ["guess_word"]);
  });

  it("awards artists the win when the Fake Artist guesses correctly", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);
    castVote(game, P1, P2);
    castVote(game, P2, P1);
    castVote(game, P3, P2);

    game.performAction(P2, { type: "guess_word", word: "  PIZZA  " });

    assert.equal(game.getPublicState().phase, "RESULTS");
    assert.equal(game.getPublicState().winner, "artists");
  });

  it("awards the Fake Artist the win on an incorrect guess", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);
    castVote(game, P1, P2);
    castVote(game, P2, P1);
    castVote(game, P3, P2);

    game.performAction(P2, { type: "guess_word", word: "Sushi" });

    assert.equal(game.getPublicState().phase, "RESULTS");
    assert.equal(game.getPublicState().winner, "fakeArtist");
  });

  it("awards the Fake Artist the win when accused player is not the Fake Artist", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);
    castVote(game, P1, P3);
    castVote(game, P2, P3);
    castVote(game, P3, P1);

    assert.equal(game.getPublicState().phase, "RESULTS");
    assert.equal(game.getPublicState().winner, "fakeArtist");
  });

  it("awards the Fake Artist the win on a tied top vote", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3, P4], P2);
    completeDrawing(game, [P1, P2, P3, P4]);
    castVote(game, P1, P3);
    castVote(game, P2, P4);
    castVote(game, P3, P1);
    castVote(game, P4, P2);

    assert.equal(game.getPublicState().phase, "RESULTS");
    assert.equal(game.getPublicState().winner, "fakeArtist");
  });

  it("rejects guess_word from non-Fake-Artist players", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);
    castVote(game, P1, P2);
    castVote(game, P2, P1);
    castVote(game, P3, P2);

    assert.throws(
      () => game.performAction(P1, { type: "guess_word", word: "Pizza" }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "Only the Fake Artist can guess",
    );
  });

  it("rejects duplicate guesses after RESULTS", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);
    castVote(game, P1, P2);
    castVote(game, P2, P1);
    castVote(game, P3, P2);
    game.performAction(P2, { type: "guess_word", word: "Pizza" });

    assert.throws(
      () => game.performAction(P2, { type: "guess_word", word: "Pizza" }),
      (error: unknown) =>
        error instanceof GameError && error.message === "It is not time to guess",
    );
  });

  it("resolves votes exactly once", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);
    castVote(game, P1, P3);
    castVote(game, P2, P3);
    castVote(game, P3, P1);

    assert.equal(game.getPublicState().phase, "RESULTS");
    assert.equal(asInternals(game).winner, "fakeArtist");
  });
});

describe("FakeArtistGame termination and leave", () => {
  it("aborts when the Fake Artist leaves", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    game.onPlayerRemoved(P2);

    assert.equal(game.getPublicState().phase, "ABORTED");
    assert.equal(game.getPublicState().winner, "aborted");
  });

  it("aborts when fewer than 3 players remain", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3, P4], P2);
    game.onPlayerRemoved(P4);
    game.onPlayerRemoved(P3);

    assert.equal(game.getPublicState().phase, "ABORTED");
  });

  it("continues when a non-Fake Artist leaves and can force voting if the queue is exhausted", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3, P4], P2);
    asInternals(game).turnIndex = 7;
    game.onPlayerRemoved(P4);

    assert.equal(game.getPublicState().phase, "VOTING");
    assert.equal(asInternals(game).players.size, 3);
  });

  it("rejects actions in terminal phases via phase guards", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    asInternals(game).phase = "RESULTS";

    assert.throws(
      () => castVote(game, P1, P2),
      (error: unknown) =>
        error instanceof GameError && error.message === "It is not time to vote",
    );
    assert.throws(
      () => game.performAction(P1, { type: "submit_stroke", points: stroke() }),
      (error: unknown) =>
        error instanceof GameError && error.message === "It is not time to draw",
    );
    assert.throws(
      () => game.performAction(P2, { type: "guess_word", word: "Pizza" }),
      (error: unknown) =>
        error instanceof GameError && error.message === "It is not time to guess",
    );
  });
});

describe("FakeArtistGame adversarial server checks", () => {
  it("uses the authenticated voter and ignores any implicit client identity in payloads", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);

    castVote(game, P1, P2);

    assert.equal(asInternals(game).votes.get(P1), P2);
    assert.equal(asInternals(game).votes.has(P2), false);
  });

  it("evaluates guess correctness server-side with normalization", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    setWord(game, "Ice Cream");
    completeDrawing(game, [P1, P2, P3]);
    castVote(game, P1, P2);
    castVote(game, P2, P1);
    castVote(game, P3, P2);

    game.performAction(P2, { type: "guess_word", word: "ice   cream" });

    assert.equal(game.getPublicState().winner, "artists");
  });

  it("does not accept a stale drawing action after the round moved to voting", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);

    assert.throws(
      () => game.performAction(P3, { type: "submit_stroke", points: stroke() }),
      (error: unknown) =>
        error instanceof GameError && error.message === "It is not time to draw",
    );
  });
});

describe("FakeArtistGame second-pass adversarial", () => {
  it("enters GUESS on unique plurality without requiring a strict majority", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3, P4], P2);
    completeDrawing(game, [P1, P2, P3, P4]);
    castVote(game, P1, P2);
    castVote(game, P2, P1);
    castVote(game, P3, P2);
    castVote(game, P4, P3);

    assert.equal(game.getPublicState().phase, "GUESS");
  });

  for (let count = 3; count <= 10; count += 1) {
    it(`${count} players queue two full drawing passes (${count * 2} turns)`, () => {
      const ids = playerIds(count);
      const game = new FakeArtistGame();
      setupFixedOrder(game, ids, ids[1]);
      assert.equal(asInternals(game).turnQueue.length, count * 2);
      completeDrawing(game, ids);
      assert.equal(game.getPublicState().phase, "VOTING");
    });
  }

  it("keeps secrets hidden through DRAWING, VOTING, and GUESS", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);

    assertNoSecretLeakDuringPlay(game, P2, P1);

    completeDrawing(game, [P1, P2, P3]);
    assertNoSecretLeakDuringPlay(game, P2, P1);

    castVote(game, P1, P2);
    castVote(game, P2, P1);
    castVote(game, P3, P2);
    assert.equal(game.getPublicState().phase, "GUESS");
    assertNoSecretLeakDuringPlay(game, P2, P1);

    game.performAction(P2, { type: "guess_word", word: "wrong" });
    const results = game.getPublicState();
    assert.equal(results.phase, "RESULTS");
    assert.equal(results.word, "Pizza");
    assert.equal(results.fakeArtistId, P2);
  });

  it("never exposes the secret word to the Fake Artist via private state at any phase", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);
    castVote(game, P1, P2);
    castVote(game, P2, P1);
    castVote(game, P3, P2);

    assert.equal(game.getPrivateState(P2).word, undefined);
    game.performAction(P2, { type: "guess_word", word: "Pizza" });
    assert.equal(game.getPrivateState(P2).word, undefined);
  });

  it("rejects actions from removed players", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3, P4], P2);
    completeDrawing(game, [P1, P2, P3, P4]);
    game.onPlayerRemoved(P4);

    assert.throws(
      () => castVote(game, P4, P1),
      (error: unknown) =>
        error instanceof GameError && error.message === "You are not in this game",
    );
  });

  it("rejects voting after the phase leaves VOTING", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);
    castVote(game, P1, P2);
    castVote(game, P2, P1);
    castVote(game, P3, P2);

    assert.equal(game.getPublicState().phase, "GUESS");
    assert.throws(
      () => castVote(game, P1, P2),
      (error: unknown) =>
        error instanceof GameError && error.message === "It is not time to vote",
    );
  });

  it("rejects an empty guess from the Fake Artist", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);
    castVote(game, P1, P2);
    castVote(game, P2, P1);
    castVote(game, P3, P2);

    assert.throws(
      () => game.performAction(P2, { type: "guess_word", word: "   " }),
      (error: unknown) =>
        error instanceof GameError && error.message === "Guess cannot be empty",
    );
    assert.equal(game.getPublicState().phase, "GUESS");
  });

  it("continues GUESS when a non-Fake Artist leaves with at least 3 players remaining", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3, P4], P2);
    completeDrawing(game, [P1, P2, P3, P4]);
    castVote(game, P1, P2);
    castVote(game, P2, P1);
    castVote(game, P3, P2);
    castVote(game, P4, P3);
    game.onPlayerRemoved(P4);

    assert.equal(game.getPublicState().phase, "GUESS");
    game.performAction(P2, { type: "guess_word", word: "Pizza" });
    assert.equal(game.getPublicState().winner, "artists");
  });

  it("skips the current drawer when they leave mid DRAWING and advances to the next queued player", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3, P4], P4);
    game.performAction(P1, { type: "submit_stroke", points: stroke() });
    assert.equal(game.getPublicState().currentPlayerId, P2);

    game.onPlayerRemoved(P2);

    assert.equal(game.getPublicState().phase, "DRAWING");
    assert.equal(game.getPublicState().currentPlayerId, P3);
    assert.equal(asInternals(game).players.has(P2), false);
  });

  it("prunes a departed player from remaining drawing turns without soft-locking", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3, P4], P2);
    game.onPlayerRemoved(P4);

    const remainingTurns = asInternals(game).turnQueue.length - asInternals(game).turnIndex;
    for (let i = 0; i < remainingTurns; i += 1) {
      const current = game.getPublicState().currentPlayerId;
      assert.ok(current);
      game.performAction(current, { type: "submit_stroke", points: stroke() });
    }

    assert.equal(game.getPublicState().phase, "VOTING");
  });

  it("drops a departed voter's ballot and resolves when remaining players have all voted", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3, P4], P2);
    completeDrawing(game, [P1, P2, P3, P4]);
    castVote(game, P1, P2);
    castVote(game, P2, P1);
    castVote(game, P3, P2);
    game.onPlayerRemoved(P4);

    assert.equal(game.getPublicState().phase, "GUESS");
  });

  it("does not resolve voting early when a non-voter leaves before everyone else has voted", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3, P4], P2);
    completeDrawing(game, [P1, P2, P3, P4]);
    castVote(game, P1, P2);
    game.onPlayerRemoved(P4);

    assert.equal(game.getPublicState().phase, "VOTING");
    assert.deepEqual(game.getPublicState().votedPlayerIds, [P1]);
  });

  it("accepts a stroke after endsAt has passed until onTimer runs (post-deadline window)", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    setDeadline(game, Date.now() - 1);

    game.performAction(P1, { type: "submit_stroke", points: stroke() });

    assert.equal(game.getPublicState().currentPlayerId, P2);
    assert.equal(game.getPublicState().strokes.length, 1);
  });

  it("does not double-enter VOTING when onTimer fires after the final stroke already advanced the phase", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    asInternals(game).turnIndex = 5;
    setDeadline(game, Date.now() - 1);

    game.performAction(P3, { type: "submit_stroke", points: stroke() });
    assert.equal(game.getPublicState().phase, "VOTING");

    game.onTimer();
    assert.equal(game.getPublicState().phase, "VOTING");
  });

  it("rejects a stroke from a skipped player after onTimer advanced the turn", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    setDeadline(game, Date.now() - 1);
    game.onTimer();

    assert.throws(
      () => game.performAction(P1, { type: "submit_stroke", points: stroke() }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "It is not your turn to draw",
    );
  });

  it("awards Fake Artist win when votes target a player who already left", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3, P4], P2);
    completeDrawing(game, [P1, P2, P3, P4]);
    castVote(game, P1, P4);
    castVote(game, P2, P4);
    castVote(game, P3, P1);
    game.onPlayerRemoved(P4);

    assert.equal(game.getPublicState().phase, "RESULTS");
    assert.equal(game.getPublicState().winner, "fakeArtist");
  });

  it("binds vote identity to the authenticated voter, not the target field", () => {
    const game = new FakeArtistGame();
    setupFixedOrder(game, [P1, P2, P3], P2);
    completeDrawing(game, [P1, P2, P3]);

    castVote(game, P1, P3);

    assert.equal(asInternals(game).votes.get(P1), P3);
    assert.equal(asInternals(game).votes.has(P3), false);
  });
});
