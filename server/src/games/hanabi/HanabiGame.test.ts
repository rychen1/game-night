import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameError } from "../Game.ts";
import { handSizeFor } from "./deck.ts";
import { HanabiGame } from "./HanabiGame.ts";
import {
  arrangeFinalDraw,
  asInternals,
  card,
  emptyDeckViaAction,
  emptyKnowledge,
  passTurnWithClue,
  setupWithOrder,
} from "./testHelpers.ts";

const P1 = "p1";
const P2 = "p2";
const P3 = "p3";
const P4 = "p4";
const P5 = "p5";

describe("HanabiGame setup", () => {
  for (const [count, expectedHand] of [
    [2, 5],
    [3, 5],
    [4, 4],
    [5, 4],
  ] as const) {
    it(`deals ${expectedHand} cards each to ${count} players`, () => {
      const ids = Array.from({ length: count }, (_, i) => `p${i + 1}`);
      const game = new HanabiGame();
      setupWithOrder(game, ids);

      for (const id of ids) {
        assert.equal(
          game.getPrivateState(id).hands[id]?.length,
          expectedHand,
        );
      }
      assert.equal(
        game.getPublicState().deckCount,
        50 - expectedHand * count,
      );
    });
  }

  it("initializes clue, fuse, and stack state", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);

    const state = game.getPublicState();
    assert.equal(state.clueTokens, 8);
    assert.equal(state.fuseTokens, 3);
    assert.equal(state.finalTurnsLeft, null);
    assert.deepEqual(state.stacks, {
      red: 0,
      yellow: 0,
      green: 0,
      blue: 0,
      white: 0,
    });
    assert.equal(state.phase, "PLAYING");
    assert.equal(handSizeFor(2), 5);
    assert.equal(handSizeFor(4), 4);
  });
});

describe("HanabiGame hidden information", () => {
  it("hides own card identities during PLAYING", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);

    for (const view of game.getPrivateState(P1).hands[P1] ?? []) {
      assert.equal(view.color, undefined);
      assert.equal(view.rank, undefined);
      assert.ok(view.cardId);
    }
  });

  it("shows opponents' card identities during PLAYING", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);

    for (const view of game.getPrivateState(P1).hands[P2] ?? []) {
      assert.ok(view.color);
      assert.ok(view.rank);
    }
  });

  it("does not expose hand card identities in public state", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);

    const pub = game.getPublicState() as Record<string, unknown>;
    assert.equal(pub.hands, undefined);
    assert.deepEqual(pub.handSizes, { [P1]: 5, [P2]: 5 });
  });

  it("reveals own faces in RESULTS", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);
    asInternals(game).phase = "RESULTS";
    asInternals(game).endReason = "deck";

    for (const view of game.getPrivateState(P1).hands[P1] ?? []) {
      assert.ok(view.color);
      assert.ok(view.rank);
    }
  });
});

describe("HanabiGame clues", () => {
  it("rejects self-clues", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);

    assert.throws(
      () =>
        game.performAction(P1, {
          type: "give_clue",
          targetPlayerId: P1,
          clue: { type: "color", value: "red" },
        }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "You cannot clue yourself",
    );
  });

  it("rejects clues with zero clue tokens", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);
    asInternals(game).clueTokens = 0;

    assert.throws(
      () =>
        game.performAction(P1, {
          type: "give_clue",
          targetPlayerId: P2,
          clue: { type: "color", value: "red" },
        }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "No clue tokens left",
    );
  });

  it("rejects clues that match no cards", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);
    asInternals(game).cards = new Map([
      ["c1", card("c1", "blue", 1)],
      ["p1c", card("p1c", "green", 1)],
    ]);
    asInternals(game).hands = new Map([
      [P1, ["p1c"]],
      [P2, ["c1"]],
    ]);

    assert.throws(
      () =>
        game.performAction(P1, {
          type: "give_clue",
          targetPlayerId: P2,
          clue: { type: "color", value: "red" },
        }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "A clue must touch at least one card",
    );
  });

  it("marks every matching card and negative knowledge on nonmatches", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);
    asInternals(game).cards = new Map([
      ["match", card("match", "red", 2)],
      ["other", card("other", "blue", 1)],
      ["p1c", card("p1c", "green", 1)],
    ]);
    asInternals(game).hands = new Map([
      [P1, ["p1c"]],
      [P2, ["match", "other"]],
    ]);
    asInternals(game).knowledge = new Map([
      ["match", emptyKnowledge()],
      ["other", emptyKnowledge()],
    ]);

    game.performAction(P1, {
      type: "give_clue",
      targetPlayerId: P2,
      clue: { type: "color", value: "red" },
    });

    const priv = game.getPrivateState(P2);
    const match = priv.hands[P2]?.find((view) => view.cardId === "match");
    const other = priv.hands[P2]?.find((view) => view.cardId === "other");
    assert.equal(match?.knowledge.knownColor, "red");
    assert.deepEqual(other?.knowledge.notColors, ["red"]);
  });

  it("consumes one clue token and advances the turn without drawing", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);
    asInternals(game).cards = new Map([
      ["c1", card("c1", "green", 1)],
      ["p1c", card("p1c", "yellow", 1)],
    ]);
    asInternals(game).hands = new Map([
      [P1, ["p1c"]],
      [P2, ["c1"]],
    ]);

    const deckBefore = game.getPublicState().deckCount;
    game.performAction(P1, {
      type: "give_clue",
      targetPlayerId: P2,
      clue: { type: "color", value: "green" },
    });

    assert.equal(game.getPublicState().clueTokens, 7);
    assert.equal(game.getPublicState().currentPlayerId, P2);
    assert.equal(game.getPublicState().deckCount, deckBefore);
    assert.equal(game.getPrivateState(P1).hands[P1]?.length, 1);
  });
});

describe("HanabiGame playing cards", () => {
  it("advances the fireworks stack on a correct play", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);
    asInternals(game).cards = new Map([["r1", card("r1", "red", 1)]]);
    asInternals(game).hands = new Map([[P1, ["r1"]]]);

    game.performAction(P1, { type: "play_card", cardId: "r1" });

    assert.equal(game.getPublicState().stacks.red, 1);
    assert.equal(game.getPublicState().fuseTokens, 3);
  });

  it("discards a misplay and loses one fuse", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);
    asInternals(game).cards = new Map([["bad", card("bad", "red", 2)]]);
    asInternals(game).hands = new Map([[P1, ["bad"]]]);

    game.performAction(P1, { type: "play_card", cardId: "bad" });

    assert.equal(game.getPublicState().fuseTokens, 2);
    assert.equal(game.getPublicState().discard.length, 1);
    assert.equal(game.getPublicState().discard[0]?.color, "red");
    assert.equal(game.getPublicState().stacks.red, 0);
  });

  it("restores one clue when playing a 5, capped at 8", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);
    asInternals(game).stacks.red = 4;
    asInternals(game).clueTokens = 8;
    asInternals(game).cards = new Map([["r5", card("r5", "red", 5)]]);
    asInternals(game).hands = new Map([[P1, ["r5"]]]);

    game.performAction(P1, { type: "play_card", cardId: "r5" });

    assert.equal(game.getPublicState().clueTokens, 8);
    assert.equal(game.getPublicState().stacks.red, 5);
  });

  it("draws a replacement card when the deck has cards", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);
    asInternals(game).cards = new Map([
      ["play", card("play", "red", 1)],
      ["draw", card("draw", "blue", 1)],
    ]);
    asInternals(game).hands = new Map([[P1, ["play"]]]);
    asInternals(game).deck = ["draw"];

    game.performAction(P1, { type: "play_card", cardId: "play" });

    assert.equal(game.getPublicState().deckCount, 0);
    assert.equal(game.getPrivateState(P1).hands[P1]?.length, 1);
    assert.equal(game.getPrivateState(P1).hands[P1]?.[0]?.cardId, "draw");
    assert.equal(game.getPublicState().currentPlayerId, P2);
  });

  it("rejects out-of-turn play", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);
    const cardId = game.getPrivateState(P2).hands[P2]?.[0]?.cardId;
    assert.ok(cardId);

    assert.throws(
      () => game.performAction(P2, { type: "play_card", cardId }),
      (error: unknown) =>
        error instanceof GameError && error.message === "It is not your turn",
    );
  });

  it("rejects cards not in the acting player's hand", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);

    assert.throws(
      () => game.performAction(P1, { type: "play_card", cardId: "missing" }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "That card is not in your hand",
    );
  });
});

describe("HanabiGame discarding", () => {
  it("adds the card to discard, restores a clue, draws, and advances turn", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);
    asInternals(game).clueTokens = 7;
    asInternals(game).cards = new Map([
      ["drop", card("drop", "yellow", 2)],
      ["draw", card("draw", "green", 1)],
    ]);
    asInternals(game).hands = new Map([[P1, ["drop"]]]);
    asInternals(game).deck = ["draw"];

    game.performAction(P1, { type: "discard_card", cardId: "drop" });

    assert.equal(game.getPublicState().discard.length, 1);
    assert.equal(game.getPublicState().clueTokens, 8);
    assert.equal(game.getPublicState().currentPlayerId, P2);
    assert.equal(game.getPublicState().deckCount, 0);
  });

  it("rejects discard when clue tokens are full", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);
    const cardId = game.getPrivateState(P1).hands[P1]?.[0]?.cardId;
    assert.ok(cardId);

    assert.throws(
      () =>
        game.performAction(P1, { type: "discard_card", cardId }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "Cannot discard when clue tokens are full",
    );
  });
});

describe("HanabiGame endings", () => {
  it("ends after three fuse failures", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);

    for (let i = 0; i < 3; i += 1) {
      asInternals(game).turnIndex = 0;
      asInternals(game).cards = new Map([
        [`bad-${i}`, card(`bad-${i}`, "red", 2)],
      ]);
      asInternals(game).hands = new Map([[P1, [`bad-${i}`]]]);
      game.performAction(P1, { type: "play_card", cardId: `bad-${i}` });
    }

    const state = game.getPublicState();
    assert.equal(state.phase, "RESULTS");
    assert.equal(state.endReason, "fuses");
    assert.equal(state.fuseTokens, 0);
  });

  it("ends with perfect when all fireworks are complete", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);
    asInternals(game).stacks = {
      red: 5,
      yellow: 5,
      green: 5,
      blue: 5,
      white: 4,
    };
    asInternals(game).cards = new Map([["w5", card("w5", "white", 5)]]);
    asInternals(game).hands = new Map([[P1, ["w5"]]]);

    game.performAction(P1, { type: "play_card", cardId: "w5" });

    const state = game.getPublicState();
    assert.equal(state.phase, "RESULTS");
    assert.equal(state.endReason, "perfect");
    assert.equal(state.score, 25);
  });

  it("rejects actions after game over", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);
    asInternals(game).phase = "RESULTS";

    assert.throws(
      () =>
        game.performAction(P1, {
          type: "give_clue",
          targetPlayerId: P2,
          clue: { type: "color", value: "red" },
        }),
      (error: unknown) =>
        error instanceof GameError && error.message === "The game is over",
    );
  });

  it("calculates score as the sum of stack heights", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2]);
    asInternals(game).stacks = {
      red: 3,
      yellow: 2,
      green: 1,
      blue: 4,
      white: 0,
    };
    asInternals(game).phase = "RESULTS";

    assert.equal(game.getPublicState().score, 10);
  });
});

function assertFinalRoundSequence(
  playerIds: string[],
  via: "play" | "discard",
): void {
  const game = new HanabiGame();
  const { emptierId, emptierCardId } = arrangeFinalDraw(game, playerIds, {
    via,
  });

  emptyDeckViaAction(game, emptierId, emptierCardId, via);

  assert.equal(game.getPublicState().deckCount, 0);
  assert.equal(game.getPublicState().finalTurnsLeft, playerIds.length - 1);
  assert.equal(game.getPublicState().phase, "PLAYING");

  const turnsAfterEmpty: string[] = [];
  let current = game.getPublicState().currentPlayerId;
  assert.notEqual(
    current,
    emptierId,
    "emptier should not receive another turn immediately",
  );

  for (let i = 0; i < playerIds.length - 1; i += 1) {
    turnsAfterEmpty.push(current);
    assert.notEqual(
      current,
      emptierId,
      "emptier must not receive a post-empty final turn",
    );
    passTurnWithClue(game, current, playerIds);
    if (i < playerIds.length - 2) {
      assert.equal(game.getPublicState().phase, "PLAYING");
      current = game.getPublicState().currentPlayerId;
    }
  }

  assert.equal(game.getPublicState().phase, "RESULTS");
  assert.equal(game.getPublicState().endReason, "deck");
  assert.equal(turnsAfterEmpty.length, playerIds.length - 1);

  for (const id of playerIds) {
    if (id === emptierId) {
      continue;
    }
    assert.equal(
      turnsAfterEmpty.filter((turn) => turn === id).length,
      1,
      `${id} should act exactly once after the deck empties`,
    );
  }
}

describe("HanabiGame final round regression", () => {
  for (const count of [2, 3, 4, 5]) {
    const playerIds = Array.from({ length: count }, (_, i) => `p${i + 1}`);

    it(`${count} players: discard path leaves N-1 turns after the final draw`, () => {
      assertFinalRoundSequence(playerIds, "discard");
    });

    it(`${count} players: play path leaves N-1 turns after the final draw`, () => {
      assertFinalRoundSequence(playerIds, "play");
    });
  }

  it("continues countdown when the deck is already empty at turn start", () => {
    const game = new HanabiGame();
    setupWithOrder(game, [P1, P2, P3]);
    asInternals(game).turnIndex = 1;
    asInternals(game).deck = [];
    asInternals(game).finalTurnsLeft = 2;
    asInternals(game).clueTokens = 8;
    asInternals(game).cards = new Map([
      ["b1", card("b1", "green", 1)],
      ["c1", card("c1", "yellow", 1)],
    ]);
    asInternals(game).hands = new Map([
      [P1, ["hold-p1"]],
      [P2, ["b1"]],
      [P3, ["c1"]],
    ]);
    asInternals(game).cards.set("hold-p1", card("hold-p1", "red", 1));

    passTurnWithClue(game, P2, [P1, P2, P3]);

    assert.equal(game.getPublicState().finalTurnsLeft, 1);
    assert.equal(game.getPublicState().phase, "PLAYING");
    assert.equal(game.getPublicState().currentPlayerId, P3);
  });
});
