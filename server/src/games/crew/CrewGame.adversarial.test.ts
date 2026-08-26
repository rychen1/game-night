import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseClientMessage } from "../../protocol/messages.ts";
import { GameError } from "../Game.ts";
import { handSizeFor } from "./deck.ts";
import { CrewGame } from "./CrewGame.ts";
import {
  allHandAndTrickCardIds,
  asInternals,
  assertRejectedAction,
  beginPlaying,
  buildOrderedDeck,
  card,
  dealFromDeck,
  mustNotWinTask,
  playerIds,
  seedHands,
  winTask,
} from "./testHelpers.ts";

const P1 = "p1";
const P2 = "p2";
const P3 = "p3";

function playCard(game: CrewGame, playerId: string, cardId: string): void {
  game.performAction(playerId, { type: "crew_play_card", cardId });
}

function playCurrentCard(game: CrewGame): string {
  const current = game.getPublicState().currentPlayerId;
  const cardId = game.getPrivateState(current).playableCardIds?.[0]
    ?? game.getPrivateState(current).hand[0]?.cardId;
  assert.ok(cardId);
  playCard(game, current, cardId);
  return cardId;
}

describe("CrewGame second-pass card accounting", () => {
  it("deals exactly 10 cards per player and 20 undealt in a 2-player game", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    const internal = asInternals(game);

    assert.equal(internal.cards.size, 40);
    assert.equal(game.getPrivateState(P1).hand.length, 10);
    assert.equal(game.getPrivateState(P2).hand.length, 10);

    const dealt = allHandAndTrickCardIds(game);
    assert.equal(dealt.length, 20);
    assert.equal(new Set(dealt).size, 20);
  });

  for (const count of [2, 3, 4, 5]) {
    it(`${count} players deal ${handSizeFor(count)} cards each with no duplicates`, () => {
      const ids = playerIds(count);
      const game = new CrewGame();
      game.setup(ids);
      const dealt = allHandAndTrickCardIds(game);
      assert.equal(dealt.length, handSizeFor(count) * count);
      assert.equal(new Set(dealt).size, dealt.length);
      assert.equal(asInternals(game).cards.size, 40);
    });
  }

  it("conserves card IDs through a complete 2-player mission", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    asInternals(game).tasks = [mustNotWinTask("pending", P1, "yellow", 9)];
    game.performAction(P1, { type: "crew_begin_mission" });
    assert.equal(game.getPublicState().phase, "PLAYING");

    const initial = new Set(allHandAndTrickCardIds(game));
    const played = new Set<string>();

    while (game.getPublicState().phase === "PLAYING") {
      const current = game.getPublicState().currentPlayerId;
      const cardId = game.getPrivateState(current).playableCardIds?.[0]
        ?? game.getPrivateState(current).hand[0]?.cardId;
      assert.ok(cardId);
      playCard(game, current, cardId);
      played.add(cardId);

      if (game.getPublicState().currentTrick.length === 0) {
        const active = new Set(allHandAndTrickCardIds(game));
        assert.equal(active.size + played.size, initial.size);
      }
    }

    assert.ok(played.size > 0);
  });
});

describe("CrewGame second-pass trick resolution and turn order", () => {
  it("clears currentTrick and sets leader to winner after each trick", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    asInternals(game).phase = "PLAYING";
    asInternals(game).order = [P1, P2];
    asInternals(game).turnIndex = 0;
    asInternals(game).tasks = [winTask("pending", P1, "blue", 9)];
    seedHands(game, {
      [P1]: [card("lead", "blue", 9)],
      [P2]: [card("follow", "blue", 2)],
    });

    playCard(game, P1, "lead");
    assert.equal(game.getPublicState().currentTrick.length, 1);
    playCard(game, P2, "follow");

    const state = game.getPublicState();
    assert.equal(state.currentTrick.length, 0);
    assert.equal(state.completedTricks.length, 1);
    assert.equal(state.completedTricks[0]?.winnerId, P1);
    assert.equal(state.currentPlayerId, P1);
    assert.equal(asInternals(game).turnIndex, 0);
  });

  it("advances turnIndex once per card until the trick completes", () => {
    const game = new CrewGame();
    game.setup([P1, P2, P3]);
    asInternals(game).phase = "PLAYING";
    asInternals(game).order = [P1, P2, P3];
    asInternals(game).turnIndex = 0;
    asInternals(game).tasks = [winTask("pending", P1, "blue", 9)];
    seedHands(game, {
      [P1]: [card("a", "red", 1)],
      [P2]: [card("b", "red", 2)],
      [P3]: [card("c", "red", 3)],
    });

    playCard(game, P1, "a");
    assert.equal(asInternals(game).turnIndex, 1);
    assert.equal(game.getPublicState().currentPlayerId, P2);
    playCard(game, P2, "b");
    assert.equal(asInternals(game).turnIndex, 2);
    playCard(game, P3, "c");
    assert.equal(game.getPublicState().currentTrick.length, 0);
    assert.equal(game.getPublicState().completedTricks.length, 1);
  });

  it("awards trump over led suit in actual play resolution", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    asInternals(game).phase = "PLAYING";
    asInternals(game).order = [P1, P2];
    asInternals(game).turnIndex = 0;
    asInternals(game).tasks = [winTask("pending", P1, "blue", 9)];
    seedHands(game, {
      [P1]: [card("lead", "yellow", 9)],
      [P2]: [card("trump", "submarine", 1)],
    });

    playCard(game, P1, "lead");
    playCard(game, P2, "trump");

    assert.equal(game.getPublicState().completedTricks[0]?.winnerId, P2);
    assert.equal(game.getPublicState().currentPlayerId, P2);
  });
});

describe("CrewGame second-pass follow-suit", () => {
  it("allows off-suit play when the led suit is unavailable", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    asInternals(game).phase = "PLAYING";
    asInternals(game).order = [P1, P2];
    asInternals(game).turnIndex = 0;
    asInternals(game).tasks = [winTask("pending", P1, "blue", 9)];
    seedHands(game, {
      [P1]: [card("lead", "blue", 9)],
      [P2]: [card("off", "red", 1)],
    });

    playCard(game, P1, "lead");
    playCard(game, P2, "off");
    assert.equal(game.getPublicState().completedTricks.length, 1);
  });

  it("rejects illegal off-suit play without mutating state", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    asInternals(game).phase = "PLAYING";
    asInternals(game).order = [P1, P2];
    asInternals(game).turnIndex = 0;
    asInternals(game).tasks = [winTask("pending", P1, "blue", 9)];
    seedHands(game, {
      [P1]: [card("lead", "blue", 9)],
      [P2]: [card("follow", "blue", 2), card("off", "red", 1)],
    });

    playCard(game, P1, "lead");
    assertRejectedAction(game, () => playCard(game, P2, "off"));
    playCard(game, P2, "follow");
  });

  it("recomputes follow-suit options after earlier tricks shrink the hand", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    asInternals(game).phase = "PLAYING";
    asInternals(game).order = [P1, P2];
    asInternals(game).turnIndex = 0;
    asInternals(game).tasks = [mustNotWinTask("pending", P1, "red", 1)];
    seedHands(game, {
      [P1]: [card("t1a", "blue", 1), card("t2a", "blue", 5), card("bad", "red", 1)],
      [P2]: [card("t1b", "blue", 9), card("t2b", "blue", 2)],
    });

    playCard(game, P1, "t1a");
    playCard(game, P2, "t1b");
    playCard(game, P2, "t2b");
    assertRejectedAction(game, () => playCard(game, P1, "bad"));
    playCard(game, P1, "t2a");
  });
});

describe("CrewGame second-pass stale and duplicate actions", () => {
  it("rejects playing the same card twice", () => {
    const game = new CrewGame();
    beginPlaying(game);
    const current = game.getPublicState().currentPlayerId;
    const cardId = game.getPrivateState(current).hand[0]!.cardId;
    playCard(game, current, cardId);
    assertRejectedAction(game, () => playCard(game, current, cardId));
  });

  it("rejects stale play after trick resolution", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    asInternals(game).phase = "PLAYING";
    asInternals(game).order = [P1, P2];
    asInternals(game).turnIndex = 0;
    asInternals(game).tasks = [mustNotWinTask("pending", P1, "red", 1)];
    seedHands(game, {
      [P1]: [card("r1", "red", 1)],
      [P2]: [card("b2", "blue", 2)],
    });

    playCard(game, P1, "r1");
    assertRejectedAction(game, () => playCard(game, P1, "r1"));
  });

  it("rejects begin_mission after PLAYING starts", () => {
    const game = new CrewGame();
    beginPlaying(game);
    assert.throws(
      () => game.performAction(P1, { type: "crew_begin_mission" }),
      (error: unknown) =>
        error instanceof GameError && error.message === "The mission has already begun",
    );
  });
});

describe("CrewGame second-pass communication", () => {
  it("accepts highest, lowest, and only color communications when valid", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    asInternals(game).phase = "PLAYING";
    asInternals(game).order = [P1, P2];
    asInternals(game).tasks = [winTask("pending", P1, "blue", 9)];
    seedHands(game, {
      [P1]: [card("low", "blue", 2), card("high", "blue", 9), card("only-red", "red", 5)],
      [P2]: [card("x", "green", 1)],
    });

    game.performAction(P1, {
      type: "crew_communicate",
      cardId: "high",
      signal: "highest",
      attribute: "color",
    });
    assert.equal(game.getPublicState().communications[0]?.card.color, "blue");
    assert.equal(game.getPublicState().communications[0]?.card.rank, 9);

    game.performAction(P2, {
      type: "crew_communicate",
      cardId: "x",
      signal: "only",
      attribute: "color",
    });
    assert.equal(game.getPublicState().communications.length, 2);
  });

  it("rejects communication with a card not in hand", () => {
    const game = new CrewGame();
    beginPlaying(game);
    assertRejectedAction(game, () =>
      game.performAction(P1, {
        type: "crew_communicate",
        cardId: "missing",
        signal: "only",
        attribute: "color",
      }),
    );
  });

  it("rejects communication after mission success", () => {
    const game = new CrewGame();
    beginPlaying(game);
    asInternals(game).phase = "RESULTS";
    asInternals(game).endReason = "success";
    assertRejectedAction(game, () =>
      game.performAction(P2, {
        type: "crew_communicate",
        cardId: "missing",
        signal: "only",
        attribute: "color",
      }),
    );
  });
});

describe("CrewGame second-pass hidden information", () => {
  it("does not expose opponent hand faces in public state during PLAYING", () => {
    const game = new CrewGame();
    beginPlaying(game);
    const pub = game.getPublicState() as Record<string, unknown>;
    assert.equal(pub.finalHands, undefined);
    assert.ok(!("hand" in pub));
    for (const trick of game.getPublicState().completedTricks) {
      for (const play of trick.plays) {
        assert.ok(play.card.color);
        assert.ok(play.card.rank);
        assert.equal((play.card as Record<string, unknown>).cardId, undefined);
      }
    }
  });

  it("scopes private hands to the requesting player only", () => {
    const game = new CrewGame();
    beginPlaying(game);
    const hand1 = game.getPrivateState(P1).hand.map((entry) => entry.cardId);
    const hand2 = game.getPrivateState(P2).hand.map((entry) => entry.cardId);
    assert.notDeepEqual(hand1, hand2);
    assert.equal(new Set(hand1).size, hand1.length);
    assert.equal(new Set(hand2).size, hand2.length);
  });

  it("rejects private state lookup for a non-member via performAction", () => {
    const game = new CrewGame();
    beginPlaying(game);
    assert.throws(
      () =>
        game.performAction("missing", {
          type: "crew_play_card",
          cardId: game.getPrivateState(P1).hand[0]!.cardId,
        }),
      (error: unknown) =>
        error instanceof GameError && error.message === "You are not in this game",
    );
  });
});

describe("CrewGame second-pass projection mutation safety", () => {
  it("does not mutate authoritative state through public projection arrays", () => {
    const game = new CrewGame();
    beginPlaying(game);
    const expectedOrder = [...game.getPublicState().order];
    const pub = game.getPublicState();
    pub.order.reverse();
    pub.currentTrick.push({
      playerId: "evil",
      card: { color: "red", rank: 1 },
    });
    pub.communications.push({
      playerId: "evil",
      cardId: "evil",
      signal: "only",
      attribute: "color",
      card: { color: "red", rank: 1 },
    });

    const fresh = game.getPublicState();
    assert.deepEqual(fresh.order, expectedOrder);
    assert.equal(fresh.currentTrick.length, 0);
    assert.equal(fresh.communications.length, 0);
  });

  it("does not mutate authoritative hands through private projection", () => {
    const game = new CrewGame();
    beginPlaying(game);
    const priv = game.getPrivateState(P1);
    priv.hand.push({ cardId: "evil", color: "red", rank: 1 });
    assert.equal(game.getPrivateState(P1).hand.length, 10);
  });
});

describe("CrewGame second-pass mission-ending races", () => {
  it("ends exactly once when the final trick both satisfies and completes the mission", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    asInternals(game).phase = "PLAYING";
    asInternals(game).order = [P1, P2];
    asInternals(game).turnIndex = 1;
    asInternals(game).tasks = [mustNotWinTask("pending", P1, "red", 1)];
    seedHands(game, {
      [P1]: [card("safe", "blue", 3)],
      [P2]: [card("r1", "red", 1)],
    });

    playCard(game, P2, "r1");
    playCard(game, P1, "safe");

    assert.equal(game.getPublicState().phase, "RESULTS");
    assert.equal(game.getPublicState().endReason, "success");
    assert.equal(game.getPublicState().completedTricks.length, 1);
    assert.throws(
      () => playCard(game, P2, "r1"),
      (error: unknown) =>
        error instanceof GameError && error.message === "The game is over",
    );
  });

  it("ends in failure when one task fails even if another remains pending", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    asInternals(game).phase = "PLAYING";
    asInternals(game).order = [P1, P2];
    asInternals(game).turnIndex = 0;
    asInternals(game).tasks = [
      winTask("pending", P1, "blue", 9, "a"),
      winTask("pending", P2, "green", 5, "b"),
    ];
    seedHands(game, {
      [P1]: [card("b9", "blue", 9)],
      [P2]: [card("sub", "submarine", 4), card("g5", "green", 5)],
    });

    playCard(game, P1, "b9");
    playCard(game, P2, "sub");

    assert.equal(game.getPublicState().phase, "RESULTS");
    assert.equal(game.getPublicState().endReason, "failure");
    assert.equal(game.getPublicState().tasks.find((t) => t.id === "a")?.status, "failed");
    assert.equal(game.getPublicState().tasks.find((t) => t.id === "b")?.status, "pending");
  });
});

describe("CrewGame second-pass leave and terminal behavior", () => {
  it("aborts immediately on leave during PLAYING without exposing a false success", () => {
    const game = new CrewGame();
    beginPlaying(game);
    game.onPlayerRemoved(P2);
    assert.equal(game.getPublicState().phase, "ABORTED");
    assert.equal(game.getPublicState().endReason, "aborted");
  });

  it("aborts when a player leaves during RESULTS per documented leave semantics", () => {
    const game = new CrewGame();
    beginPlaying(game);
    asInternals(game).phase = "RESULTS";
    asInternals(game).endReason = "success";
    game.onPlayerRemoved(P1);
    assert.equal(game.getPublicState().phase, "ABORTED");
    assert.equal(game.getPublicState().endReason, "aborted");
  });
});

describe("CrewGame second-pass protocol parsing", () => {
  it("rejects malformed crew actions at the protocol layer", () => {
    assert.equal(
      parseClientMessage({
        type: "game_action",
        action: { type: "crew_play_card", cardId: "" },
      }).ok,
      false,
    );
    assert.equal(
      parseClientMessage({
        type: "game_action",
        action: {
          type: "crew_communicate",
          cardId: "c1",
          signal: "invalid",
          attribute: "color",
        },
      }).ok,
      false,
    );
    assert.equal(
      parseClientMessage({
        type: "game_action",
        action: { type: "crew_begin_mission", extra: true },
      }).ok,
      true,
    );
  });
});

describe("CrewGame second-pass deterministic simulation", () => {
  it("maintains invariants through alternating winners", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    asInternals(game).phase = "PLAYING";
    asInternals(game).order = [P1, P2];
    asInternals(game).turnIndex = 0;
    asInternals(game).tasks = [mustNotWinTask("pending", P1, "yellow", 1)];
    seedHands(game, {
      [P1]: [card("a", "red", 9), card("c", "blue", 9), card("e", "green", 9)],
      [P2]: [card("b", "red", 1), card("d", "blue", 1), card("f", "green", 1)],
    });

    const played = new Set<string>();
    while (game.getPublicState().phase === "PLAYING") {
      assert.equal(
        game.getPublicState().currentPlayerId,
        asInternals(game).order[asInternals(game).turnIndex],
      );
      const cardId = playCurrentCard(game);
      assert.equal(played.has(cardId), false);
      played.add(cardId);
      if (game.getPublicState().currentTrick.length === 0) {
        const latest = game.getPublicState().completedTricks.at(-1);
        assert.ok(latest);
        assert.equal(latest.plays.length, 2);
        assert.ok(latest.plays.some((play) => play.playerId === latest.winnerId));
      }
    }
  });

  it("maintains currentPlayerId === order[turnIndex] across a dealt 2-player playthrough", () => {
    const deck = buildOrderedDeck();
    const game = new CrewGame();
    game.setup([P1, P2]);
    dealFromDeck(game, [P1, P2], deck);
    asInternals(game).phase = "PLAYING";
    asInternals(game).tasks = [mustNotWinTask("pending", P1, "yellow", 9)];

    while (game.getPublicState().phase === "PLAYING") {
      const internal = asInternals(game);
      assert.equal(
        game.getPublicState().currentPlayerId,
        internal.order[internal.turnIndex],
      );
      playCurrentCard(game);
    }
  });
});
