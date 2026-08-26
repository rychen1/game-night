import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameError } from "../Game.ts";
import { CrewGame } from "./CrewGame.ts";
import {
  asInternals,
  beginPlaying,
  card,
  mustNotWinTask,
  seedHands,
  winTask,
} from "./testHelpers.ts";

const P1 = "p1";
const P2 = "p2";

function playCurrentCard(game: CrewGame): void {
  const current = game.getPublicState().currentPlayerId;
  const priv = game.getPrivateState(current);
  const cardId = priv.playableCardIds?.[0] ?? priv.hand[0]?.cardId;
  assert.ok(cardId, "expected a playable card in hand");
  game.performAction(current, { type: "crew_play_card", cardId });
}

describe("CrewGame mission lifecycle", () => {
  it("enters PLAYING when failed and pending tasks coexist at mission start", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    asInternals(game).tasks = [
      winTask("failed", P1, "green", 5, "a"),
      winTask("pending", P2, "yellow", 4, "b"),
    ];

    game.performAction(P1, { type: "crew_begin_mission" });

    const state = game.getPublicState();
    assert.equal(state.phase, "PLAYING");
    assert.equal(state.endReason, undefined);
    assert.equal(game.isGameOver(), false);
  });

  it("enters RESULTS with failure when all tasks are already failed at mission start", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    asInternals(game).tasks = [
      winTask("failed", P1, "green", 5, "a"),
      winTask("failed", P2, "yellow", 4, "b"),
    ];

    game.performAction(P1, { type: "crew_begin_mission" });

    const state = game.getPublicState();
    assert.equal(state.phase, "RESULTS");
    assert.equal(state.endReason, "failure");
    assert.equal(game.isGameOver(), true);
  });

  it("enters RESULTS with success when all tasks are already satisfied at mission start", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    asInternals(game).tasks = [
      mustNotWinTask("satisfied", P1, "red", 1, "a"),
      mustNotWinTask("satisfied", P2, "yellow", 1, "b"),
    ];

    game.performAction(P1, { type: "crew_begin_mission" });

    const state = game.getPublicState();
    assert.equal(state.phase, "RESULTS");
    assert.equal(state.endReason, "success");
    assert.equal(game.isGameOver(), true);
  });
});

describe("CrewGame trick lifecycle", () => {
  it("deals 10 cards each in a 2-player game and removes one per trick", () => {
    const game = new CrewGame();
    beginPlaying(game);

    assert.equal(game.getPrivateState(P1).hand.length, 10);
    assert.equal(game.getPrivateState(P2).hand.length, 10);

    playCurrentCard(game);
    playCurrentCard(game);

    const state = game.getPublicState();
    assert.equal(state.handSizes[P1], 9);
    assert.equal(state.handSizes[P2], 9);
    assert.equal(state.currentTrick.length, 0);
    assert.equal(state.completedTricks.length, 1);
    assert.equal(state.completedTricks[0]?.plays.length, 2);
    assert.ok(state.completedTricks[0]?.winnerId);
    assert.equal(state.currentPlayerId, state.completedTricks[0]?.winnerId);
  });

  it("rejects out-of-turn play", () => {
    const game = new CrewGame();
    beginPlaying(game);

    const current = game.getPublicState().currentPlayerId;
    const waiting = current === P1 ? P2 : P1;
    const waitingCard = game.getPrivateState(waiting).hand[0]!.cardId;

    assert.throws(
      () =>
        game.performAction(waiting, {
          type: "crew_play_card",
          cardId: waitingCard,
        }),
      (error: unknown) =>
        error instanceof GameError && error.message === "It is not your turn",
    );
  });

  it("enforces follow-suit when able", () => {
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

    game.performAction(P1, { type: "crew_play_card", cardId: "lead" });

    assert.throws(
      () => game.performAction(P2, { type: "crew_play_card", cardId: "off" }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "You must follow suit if able",
    );

    game.performAction(P2, { type: "crew_play_card", cardId: "follow" });
    assert.equal(game.getPublicState().completedTricks.length, 1);
  });
});

describe("CrewGame communication", () => {
  it("allows one communication per player without removing the card", () => {
    const game = new CrewGame();
    beginPlaying(game);

    const options = game.getPrivateState(P1).communicableOptions ?? [];
    const choice = options[0];
    assert.ok(choice, "expected a legal communication option");

    const handBefore = game.getPrivateState(P1).hand.length;
    game.performAction(P1, {
      type: "crew_communicate",
      cardId: choice.cardId,
      signal: choice.signal,
      attribute: choice.attribute,
    });

    assert.equal(game.getPrivateState(P1).hand.length, handBefore);
    assert.equal(game.getPublicState().communications.length, 1);
    assert.equal(game.getPublicState().communications[0]?.playerId, P1);
    assert.equal(
      game.getPrivateState(P1).legalActions.includes("crew_communicate"),
      false,
    );

    const retryOption = game.getPrivateState(P1).communicableOptions?.[0];
    if (retryOption) {
      assert.throws(
        () =>
          game.performAction(P1, {
            type: "crew_communicate",
            cardId: retryOption.cardId,
            signal: retryOption.signal,
            attribute: retryOption.attribute,
          }),
        (error: unknown) =>
          error instanceof GameError &&
          error.message === "You have already communicated this mission",
      );
    }
  });

  it("rejects communication outside PLAYING", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);

    assert.throws(
      () =>
        game.performAction(P1, {
          type: "crew_communicate",
          cardId: "missing",
          signal: "only",
          attribute: "color",
        }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "Communication is not available",
    );
  });

  it("rejects communication after the mission ends", () => {
    const game = new CrewGame();
    beginPlaying(game);
    asInternals(game).tasks = [mustNotWinTask("satisfied", P1, "red", 1)];
    asInternals(game).phase = "RESULTS";
    asInternals(game).endReason = "success";

    assert.throws(
      () =>
        game.performAction(P1, {
          type: "crew_communicate",
          cardId: "missing",
          signal: "only",
          attribute: "color",
        }),
      (error: unknown) =>
        error instanceof GameError && error.message === "The game is over",
    );
  });
});

describe("CrewGame information boundaries", () => {
  it("exposes only public information during PLAYING", () => {
    const game = new CrewGame();
    beginPlaying(game);

    const pub = game.getPublicState();
    const priv1 = game.getPrivateState(P1);
    const priv2 = game.getPrivateState(P2);

    assert.equal(pub.phase, "PLAYING");
    assert.equal(pub.finalHands, undefined);
    assert.equal(pub.handSizes[P1], 10);
    assert.equal(pub.handSizes[P2], 10);
    assert.equal(priv1.hand.length, 10);
    assert.equal(priv2.hand.length, 10);
    assert.ok("hand" in priv1);
    assert.ok("hand" in priv2);
    assert.ok(!("finalHands" in pub) || pub.finalHands === undefined);
    assert.ok(Array.isArray(pub.currentTrick));
    assert.ok(Array.isArray(pub.completedTricks));
    assert.ok(Array.isArray(pub.communications));
  });

  it("reveals finalHands only in RESULTS", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    assert.equal(game.getPublicState().finalHands, undefined);

    asInternals(game).tasks = [mustNotWinTask("satisfied", P1, "red", 1)];
    game.performAction(P1, { type: "crew_begin_mission" });

    const state = game.getPublicState();
    assert.equal(state.phase, "RESULTS");
    assert.ok(state.finalHands);
    assert.equal(state.finalHands?.[P1]?.length, 10);
    assert.equal(state.finalHands?.[P2]?.length, 10);
  });

  it("includes finalHands in ABORTED", () => {
    const game = new CrewGame();
    beginPlaying(game);
    game.onPlayerRemoved(P1);

    const state = game.getPublicState();
    assert.equal(state.phase, "ABORTED");
    assert.equal(state.endReason, "aborted");
    assert.ok(state.finalHands);
  });
});

describe("CrewGame mission termination", () => {
  it("ends immediately in RESULTS when a forbidden-card task fails during play", () => {
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

    game.performAction(P1, { type: "crew_play_card", cardId: "r1" });
    game.performAction(P2, { type: "crew_play_card", cardId: "b2" });

    const state = game.getPublicState();
    assert.equal(state.tasks[0]?.status, "failed");
    assert.equal(state.phase, "RESULTS");
    assert.equal(state.endReason, "failure");
    assert.ok(state.finalHands);
    assert.throws(
      () =>
        game.performAction(P1, {
          type: "crew_play_card",
          cardId: "r1",
        }),
      (error: unknown) =>
        error instanceof GameError && error.message === "The game is over",
    );
  });

  it("ends in RESULTS with success when all tasks become satisfied", () => {
    const game = new CrewGame();
    game.setup([P1, P2]);
    asInternals(game).phase = "PLAYING";
    asInternals(game).order = [P1, P2];
    asInternals(game).turnIndex = 1;
    asInternals(game).tasks = [mustNotWinTask("pending", P1, "red", 1)];
    seedHands(game, {
      [P1]: [card("b3", "blue", 3)],
      [P2]: [card("r1", "red", 1)],
    });

    game.performAction(P2, { type: "crew_play_card", cardId: "r1" });
    game.performAction(P1, { type: "crew_play_card", cardId: "b3" });

    const state = game.getPublicState();
    assert.equal(state.tasks[0]?.status, "satisfied");
    assert.equal(state.phase, "RESULTS");
    assert.equal(state.endReason, "success");
  });
});

describe("CrewGame blocks play after termination", () => {
  it("does not accept further card play in RESULTS", () => {
    const game = new CrewGame();
    beginPlaying(game);
    asInternals(game).tasks = [mustNotWinTask("satisfied", P1, "red", 1)];
    asInternals(game).phase = "RESULTS";
    asInternals(game).endReason = "failure";

    const cardId = game.getPrivateState(P1).hand[0]!.cardId;
    assert.throws(
      () =>
        game.performAction(P1, { type: "crew_play_card", cardId }),
      (error: unknown) =>
        error instanceof GameError && error.message === "The game is over",
    );
  });
});
