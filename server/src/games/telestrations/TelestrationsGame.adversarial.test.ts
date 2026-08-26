import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameError } from "../Game.ts";
import { parseClientMessage } from "../../protocol/messages.ts";
import { TelestrationsGame } from "./TelestrationsGame.ts";
import {
  asInternals,
  assertBookIntegrity,
  bookLengths,
  cloneBookLengths,
  completeGame,
  completeGameByTimeout,
  expectedPageKind,
  ownerIdFor,
  playerIds,
  setDeadline,
  setupFixedOrder,
  stroke,
  submitAllInPhase,
  submitDrawing,
  submitGuess,
  submitTaggedDrawing,
  submitTaggedGuess,
  timeoutRound,
} from "./testHelpers.ts";

const P1 = "p1";
const P2 = "p2";
const P3 = "p3";
const P4 = "p4";

function alphaPrompts(count: number): string[] {
  const words = ["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT", "GOLF", "HOTEL", "INDIA", "JULIET"];
  return words.slice(0, count);
}

function parseDrawingAction(strokes: unknown): boolean {
  const result = parseClientMessage({
    type: "game_action",
    action: { type: "submit_drawing", strokes },
  });
  return result.ok;
}

describe("TelestrationsGame second-pass chain integrity", () => {
  for (let count = 3; count <= 10; count += 1) {
    it(`${count} players maintain book.length === round + 1 after every round`, () => {
      const ids = playerIds(count);
      const game = new TelestrationsGame();
      setupFixedOrder(game, ids, alphaPrompts(count));

      assertBookIntegrity(game, ids, 0);
      for (let round = 0; round < count; round += 1) {
        submitAllInPhase(game, ids);
        assertBookIntegrity(game, ids, round + 1);
      }

      assert.equal(game.getPublicState().phase, "REVEAL");
      for (const id of ids) {
        const book = game.getPublicState().books!.find((entry) => entry.ownerId === id)!;
        assert.equal(book.pages.length, count + 1);
      }
    });
  }

  for (let count = 3; count <= 10; count += 1) {
    it(`${count} players: every (player, round) submission lands on the rotated owner book`, () => {
      const ids = playerIds(count);
      const game = new TelestrationsGame();
      setupFixedOrder(game, ids, alphaPrompts(count));

      for (let round = 0; round < count; round += 1) {
        const phase = game.getPublicState().phase;
        for (const actorId of ids) {
          const before = bookLengths(game);
          const expectedOwner = ownerIdFor(ids, actorId, round);

          if (phase === "DRAWING") {
            submitTaggedDrawing(game, actorId);
          } else {
            submitTaggedGuess(game, actorId);
          }

          for (const id of ids) {
            const expected = id === expectedOwner ? (before.get(id) ?? 0) + 1 : before.get(id);
            assert.equal(asInternals(game).books.get(id)?.length, expected);
          }

          const page = asInternals(game).books.get(expectedOwner)?.at(-1);
          assert.ok(page);
          assert.equal(page.authorId, actorId);
        }
      }
    });
  }

  for (let count = 3; count <= 10; count += 1) {
    it(`${count} players: page types alternate correctly through completion`, () => {
      const ids = playerIds(count);
      const game = new TelestrationsGame();
      setupFixedOrder(game, ids);
      completeGame(game, ids);

      for (const id of ids) {
        const book = game.getPublicState().books!.find((entry) => entry.ownerId === id)!;
        for (let pageIndex = 0; pageIndex < book.pages.length; pageIndex += 1) {
          assert.equal(book.pages[pageIndex]?.kind, expectedPageKind(pageIndex));
        }
        const finalKind = expectedPageKind(count);
        assert.equal(book.pages.at(-1)?.kind, finalKind);
      }
    });
  }
});

describe("TelestrationsGame second-pass duplicate and stale actions", () => {
  function assertUnchangedAfterReject(
    game: TelestrationsGame,
    beforeLengths: Map<string, number>,
    beforeRound: number,
    beforePhase: string,
    beforeEndsAt: number | null,
    beforeSubmitted: string[],
    action: () => void,
  ): void {
    assert.throws(action);
    assert.deepEqual([...asInternals(game).submitted], beforeSubmitted);
    assert.equal(game.getPublicState().round, beforeRound);
    assert.equal(game.getPublicState().phase, beforePhase);
    assert.equal(asInternals(game).endsAt, beforeEndsAt);
    assert.deepEqual(bookLengths(game), beforeLengths);
  }

  it("rejects duplicate drawing without mutating chain state", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitTaggedDrawing(game, P1);

    const before = cloneBookLengths(bookLengths(game));
    assertUnchangedAfterReject(
      game,
      before,
      0,
      "DRAWING",
      asInternals(game).endsAt,
      [P1],
      () => submitTaggedDrawing(game, P1),
    );
  });

  it("rejects duplicate guess without mutating chain state", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);
    submitTaggedGuess(game, P1);

    const before = cloneBookLengths(bookLengths(game));
    assertUnchangedAfterReject(
      game,
      before,
      1,
      "GUESSING",
      asInternals(game).endsAt,
      [P1],
      () => submitTaggedGuess(game, P1),
    );
  });

  it("rejects duplicate drawing with different strokes", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitDrawing(game, P1, [{ playerId: P1, points: [{ x: 0.1, y: 0.1 }] }]);

    assert.throws(() =>
      submitDrawing(game, P1, [{ playerId: P1, points: [{ x: 0.9, y: 0.9 }] }]),
    );
    assert.equal(asInternals(game).books.get(P1)?.length, 2);
  });

  it("rejects stale drawing after DRAWING → GUESSING transition", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);

    assert.throws(
      () => submitTaggedDrawing(game, P1),
      (error: unknown) =>
        error instanceof GameError && error.message === "It is not time to draw",
    );
  });

  it("rejects stale guess after GUESSING → DRAWING transition", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);

    assert.throws(
      () => submitTaggedGuess(game, P1),
      (error: unknown) =>
        error instanceof GameError && error.message === "It is not time to guess",
    );
  });

  it("rejects stale actions after entering REVEAL from GUESSING", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    completeGame(game, [P1, P2, P3]);

    assert.throws(() => submitTaggedGuess(game, P1));
    assert.throws(() => submitTaggedDrawing(game, P1));
  });

  it("rejects duplicate submission immediately after another player completes the round", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitTaggedDrawing(game, P1);
    submitTaggedDrawing(game, P2);
    submitTaggedDrawing(game, P3);

    assert.equal(game.getPublicState().phase, "GUESSING");
    assert.throws(() => submitTaggedDrawing(game, P1));
  });
});

describe("TelestrationsGame second-pass timers", () => {
  it("does not mutate state when Date.now() < endsAt", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    setDeadline(game, Date.now() + 60_000);
    const before = bookLengths(game);

    game.onTimer();

    assert.deepEqual(bookLengths(game), before);
    assert.equal(game.getPublicState().phase, "DRAWING");
    assert.equal(game.getPublicState().round, 0);
    assert.deepEqual(game.getPublicState().submittedPlayerIds, []);
  });

  it("processes timeout exactly at endsAt", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    const now = Date.now();
    setDeadline(game, now);

    game.onTimer();

    assert.equal(game.getPublicState().phase, "GUESSING");
    assert.equal(game.getPublicState().round, 1);
  });

  it("is idempotent when onTimer is called repeatedly on the same expired phase", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitTaggedDrawing(game, P1);
    setDeadline(game, Date.now() - 1);

    game.onTimer();
    const afterFirst = bookLengths(game);
    const phase = game.getPublicState().phase;
    const round = game.getPublicState().round;

    game.onTimer();
    game.onTimer();

    assert.deepEqual(bookLengths(game), afterFirst);
    assert.equal(game.getPublicState().phase, phase);
    assert.equal(game.getPublicState().round, round);
  });

  it("does not mutate REVEAL when onTimer is called", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    completeGame(game, [P1, P2, P3]);
    const books = game.getPublicState().books;

    game.onTimer();

    assert.deepEqual(game.getPublicState().books, books);
    assert.equal(game.getPublicState().phase, "REVEAL");
  });

  it("does not mutate ABORTED when onTimer is called", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.onPlayerRemoved(P2);

    game.onTimer();

    assert.equal(game.getPublicState().phase, "ABORTED");
  });

  it("advances exactly once for the final missing player under timer/action race", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitTaggedDrawing(game, P1);
    submitTaggedDrawing(game, P2);
    setDeadline(game, Date.now() - 1);

    submitTaggedDrawing(game, P3);
    game.onTimer();
    game.onTimer();

    for (const id of [P1, P2, P3]) {
      assert.equal(asInternals(game).books.get(id)?.length, 2);
    }
    assert.equal(game.getPublicState().phase, "GUESSING");
    assert.equal(game.getPublicState().round, 1);
  });
});

describe("TelestrationsGame second-pass hidden information", () => {
  it("does not expose other prompts or books through private projections for each player", () => {
    const ids = [P1, P2, P3];
    const game = new TelestrationsGame();
    setupFixedOrder(game, ids, alphaPrompts(3));
    submitAllInPhase(game, ids);

    for (const viewerId of ids) {
      for (const otherId of ids) {
        if (viewerId === otherId) {
          continue;
        }
        const priv = game.getPrivateState(viewerId) as Record<string, unknown>;
        assert.notEqual(priv.promptText, alphaPrompts(3)[ids.indexOf(otherId)]);
        if (typeof priv.guessText === "string") {
          assert.notEqual(priv.guessText, `GUESS:${otherId}`);
        }
      }
    }
  });

  it("rejects private state lookup for a non-member player id", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);

    assert.throws(
      () => game.getPrivateState("missing"),
      (error: unknown) =>
        error instanceof GameError && error.message === "You are not in this game",
    );
  });

  it("does not expose books in public state across DRAWING and GUESSING", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3], alphaPrompts(3));
    submitAllInPhase(game, [P1, P2, P3]);

    assert.equal(game.getPublicState().books, undefined);
    for (const id of [P1, P2, P3]) {
      const priv = game.getPrivateState(id);
      assert.equal(priv.promptText, undefined);
      assert.ok(priv.strokes);
    }
  });

  for (const count of [3, 6, 10]) {
    it(`${count} players: private state never includes books[] before REVEAL`, () => {
      const ids = playerIds(count);
      const game = new TelestrationsGame();
      setupFixedOrder(game, ids, alphaPrompts(count));
      submitAllInPhase(game, ids);

      const pub = game.getPublicState() as Record<string, unknown>;
      assert.equal(pub.books, undefined);
      for (const id of ids) {
        const priv = game.getPrivateState(id) as Record<string, unknown>;
        assert.equal(priv.books, undefined);
      }
    });
  }
});

describe("TelestrationsGame second-pass terminal and leave", () => {
  it("does not accept actions after REVEAL and keeps books immutable", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    completeGame(game, [P1, P2, P3]);
    const books = structuredClone(game.getPublicState().books);

    assert.throws(() => submitTaggedDrawing(game, P1));
    assert.throws(() => submitTaggedGuess(game, P1));
    game.onTimer();

    assert.deepEqual(game.getPublicState().books, books);
  });

  it("does not enter REVEAL when a player leaves before the final submission", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3, P4]);
    submitAllInPhase(game, [P1, P2, P3, P4]);
    submitAllInPhase(game, [P1, P2, P3, P4]);
    submitTaggedDrawing(game, P1);
    submitTaggedDrawing(game, P2);
    submitTaggedDrawing(game, P3);
    game.onPlayerRemoved(P4);

    assert.equal(game.getPublicState().phase, "ABORTED");
    assert.equal(game.getPublicState().books, undefined);
  });

  it("ignores leave during REVEAL without mutating reveal data", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    completeGame(game, [P1, P2, P3]);
    const books = structuredClone(game.getPublicState().books);

    game.onPlayerRemoved(P2);

    assert.equal(game.getPublicState().phase, "REVEAL");
    assert.deepEqual(game.getPublicState().books, books);
  });

  it("rejects submissions after ABORTED", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.onPlayerRemoved(P1);

    assert.throws(() => submitTaggedDrawing(game, P2));
    assert.equal(game.getPublicState().phase, "ABORTED");
  });
});

describe("TelestrationsGame second-pass malformed input", () => {
  it("protocol rejects non-finite stroke coordinates before they reach the game", () => {
    assert.equal(parseDrawingAction([{ playerId: P1, points: [{ x: Number.NaN, y: 0.5 }] }]), false);
    assert.equal(parseDrawingAction([{ playerId: P1, points: [{ x: Infinity, y: 0.5 }] }]), false);
    assert.equal(parseDrawingAction([{ playerId: P1, points: [{ x: 0.5, y: -Infinity }] }]), false);
  });

  it("protocol rejects empty point arrays and oversized point lists", () => {
    assert.equal(parseDrawingAction([{ playerId: P1, points: [] }]), false);
    const manyPoints = Array.from({ length: 501 }, (_, index) => ({ x: index / 500, y: 0.5 }));
    assert.equal(parseDrawingAction([{ playerId: P1, points: manyPoints }]), false);
  });

  it("protocol rejects empty stroke arrays and more than 50 strokes", () => {
    assert.equal(parseDrawingAction([]), false);
    const manyStrokes = Array.from({ length: 51 }, () => ({
      playerId: P1,
      points: [{ x: 0.1, y: 0.2 }],
    }));
    assert.equal(parseDrawingAction(manyStrokes), false);
  });

  it("accepts exactly 40-character guesses and rejects 41", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);

    submitGuess(game, P1, "x".repeat(40));
    assert.throws(() => submitGuess(game, P2, "x".repeat(41)));
  });

  it("accepts unicode and emoji guesses within length limits", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);

    submitGuess(game, P1, "🎨 drawing");
    const owner = ownerIdFor([P1, P2, P3], P1, 1);
    const page = asInternals(game).books.get(owner)?.at(-1);
    assert.equal(page?.kind, "guess");
    if (page?.kind === "guess") {
      assert.equal(page.text, "🎨 drawing");
    }
  });

  it("clamps out-of-range coordinates on direct game submission", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitDrawing(game, P1, [
      {
        playerId: P1,
        points: [
          { x: -5, y: 2 },
          { x: 99, y: -1 },
        ],
      },
    ]);

    const page = asInternals(game).books.get(P1)?.at(-1);
    assert.equal(page?.kind, "drawing");
    if (page?.kind === "drawing") {
      assert.deepEqual(page.strokes[0]?.points, [
        { x: 0, y: 1 },
        { x: 1, y: 0 },
      ]);
      assert.equal(page.authorId, P1);
    }
  });
});

describe("TelestrationsGame second-pass projection safety", () => {
  it("does not allow mutating authoritative state through public projection arrays", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitTaggedDrawing(game, P1);

    const pub = game.getPublicState();
    pub.submittedPlayerIds.push("evil");
    pub.playerOrder.reverse();

    assert.deepEqual(game.getPublicState().submittedPlayerIds, [P1]);
    assert.deepEqual(game.getPublicState().playerOrder, [P1, P2, P3]);
  });

  it("does not allow mutating authoritative strokes through private projection", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    submitAllInPhase(game, [P1, P2, P3]);

    const priv = game.getPrivateState(P1);
    priv.strokes?.push({ playerId: "evil", points: [{ x: 0.9, y: 0.9 }] });

    const fresh = game.getPrivateState(P1);
    assert.notEqual(fresh.strokes?.length, (priv.strokes?.length ?? 0));
  });

  it("does not allow mutating REVEAL books through public projection", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    completeGame(game, [P1, P2, P3]);
    const before = structuredClone(game.getPublicState().books);

    const pub = game.getPublicState();
    pub.books?.[0]?.pages.push({
      kind: "guess",
      authorId: "evil",
      text: "hacked",
    });

    assert.deepEqual(game.getPublicState().books, before);
  });
});

describe("TelestrationsGame second-pass timeout-only and mixed games", () => {
  for (let count = 3; count <= 10; count += 1) {
    it(`${count} players complete via timeouts only with one page per player per round`, () => {
      const ids = playerIds(count);
      const game = new TelestrationsGame();
      setupFixedOrder(game, ids);
      completeGameByTimeout(game, ids);

      assert.equal(game.getPublicState().phase, "REVEAL");
      for (const id of ids) {
        const book = game.getPublicState().books!.find((entry) => entry.ownerId === id)!;
        assert.equal(book.pages.length, count + 1);
        for (let pageIndex = 1; pageIndex < book.pages.length; pageIndex += 1) {
          assert.equal(book.pages[pageIndex]?.kind, expectedPageKind(pageIndex));
        }
      }
    });
  }

  for (const count of [3, 5, 8]) {
    it(`${count} players: mixed manual/timeout submissions preserve chain integrity`, () => {
      const ids = playerIds(count);
      const game = new TelestrationsGame();
      setupFixedOrder(game, ids, alphaPrompts(count));

      for (let round = 0; round < count; round += 1) {
        for (const [index, id] of ids.entries()) {
          if (index % 2 === 0) {
            if (game.getPublicState().phase === "DRAWING") {
              submitTaggedDrawing(game, id);
            } else {
              submitTaggedGuess(game, id);
            }
          }
        }
        if ([...asInternals(game).submitted].length < ids.length) {
          timeoutRound(game);
        }
        assertBookIntegrity(game, ids, round + 1);
      }

      assert.equal(game.getPublicState().phase, "REVEAL");
    });
  }
});

describe("TelestrationsGame second-pass cross-round knowledge isolation", () => {
  it("delivers exactly the previous page of the assigned book each round", () => {
    const ids = [P1, P2, P3];
    const game = new TelestrationsGame();
    setupFixedOrder(game, ids, alphaPrompts(3));

    submitAllInPhase(game, ids);
    submitAllInPhase(game, ids);

    assert.equal(game.getPublicState().phase, "DRAWING");
    assert.equal(game.getPublicState().round, 2);
    assert.equal(game.getPrivateState(P1).guessText, "GUESS:p3");
    assert.equal(game.getPrivateState(P2).guessText, "GUESS:p1");
    assert.equal(game.getPrivateState(P3).guessText, "GUESS:p2");
  });
});

describe("TelestrationsGame second-pass reconnect projections", () => {
  it("preserves submitted status and phase across reconnect-style reads", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3], alphaPrompts(3));
    submitTaggedDrawing(game, P1);
    const endsAt = game.getPublicState().endsAt;

    const first = game.getPrivateState(P1);
    const second = game.getPrivateState(P1);

    assert.equal(first.submitted, true);
    assert.equal(second.submitted, true);
    assert.equal(first.task, "wait");
    assert.deepEqual(first.legalActions, []);
    assert.equal(game.getPublicState().endsAt, endsAt);
    assert.deepEqual(game.getPublicState().submittedPlayerIds, [P1]);
  });

  it("returns reveal task and public books after reconnect at REVEAL", () => {
    const game = new TelestrationsGame();
    setupFixedOrder(game, [P1, P2, P3]);
    completeGame(game, [P1, P2, P3]);

    assert.equal(game.getPrivateState(P2).task, "reveal");
    assert.equal(game.getPublicState().books?.length, 3);
  });
});
