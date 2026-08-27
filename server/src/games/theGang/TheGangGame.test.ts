import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameError } from "../Game.ts";
import { TheGangGame } from "./TheGangGame.ts";
import {
  asInternals,
  assignChips,
  card,
  setCommunity,
  setHoleCards,
  setupFixedOrder,
} from "./testHelpers.ts";

const P1 = "p1";
const P2 = "p2";
const P3 = "p3";
const P4 = "p4";
const P5 = "p5";
const P6 = "p6";

describe("TheGangGame setup", () => {
  it("requires 3–6 players", () => {
    const game = new TheGangGame();
    assert.ok(game.canStart(2));
    assert.equal(game.canStart(3), null);
    assert.equal(game.canStart(6), null);
    assert.ok(game.canStart(7));
  });

  it("deals private hole cards and starts at pre-flop", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    const pub = game.getPublicState();
    assert.equal(pub.phase, "PREFLOP");
    assert.equal(pub.chipColor, "white");
    assert.equal(pub.communityCards.length, 0);
    assert.equal(game.getPrivateState(P1).holeCards.length, 2);
    assert.equal(game.getPrivateState(P2).holeCards.length, 2);
    assert.equal(game.getPrivateState(P3).holeCards.length, 2);
  });
});

describe("TheGangGame strength actions", () => {
  it("claims an unclaimed strength position", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_claim_strength", star: 2 });
    assert.deepEqual(game.getPublicState().chipHeld, [{ playerId: P1, star: 2 }]);
  });

  it("exposes strength claims sorted by star ascending", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_claim_strength", star: 3 });
    game.performAction(P2, { type: "gang_claim_strength", star: 1 });
    assert.deepEqual(game.getPublicState().chipHeld, [
      { playerId: P2, star: 1 },
      { playerId: P1, star: 3 },
    ]);
  });

  it("releases a strength claim", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_claim_strength", star: 1 });
    game.performAction(P1, { type: "gang_release_strength" });
    assert.equal(game.getPublicState().chipHeld.length, 0);
    assert.ok(game.getPublicState().chipCenter.includes(1));
  });

  it("rejects duplicate claims on the same position", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_claim_strength", star: 3 });
    assert.throws(
      () => game.performAction(P2, { type: "gang_claim_strength", star: 3 }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "That strength position is already claimed",
    );
  });

  it("prevents claiming a second position without releasing first", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_claim_strength", star: 1 });
    assert.throws(
      () => game.performAction(P1, { type: "gang_claim_strength", star: 2 }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "Release your strength claim before choosing another",
    );
  });

  it("advances only when every player has claimed a strength", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_claim_strength", star: 1 });
    assert.equal(game.getPublicState().phase, "PREFLOP");
    game.performAction(P2, { type: "gang_claim_strength", star: 2 });
    game.performAction(P3, { type: "gang_claim_strength", star: 3 });
    assert.equal(game.getPublicState().phase, "FLOP");
    assert.equal(game.getPublicState().chipColor, "yellow");
    assert.equal(game.getPublicState().communityCards.length, 3);
  });

  it("reveals community cards through flop, turn, and river", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    const claimRound = (stars: number[]) => {
      stars.forEach((star, index) => {
        game.performAction([P1, P2, P3][index]!, {
          type: "gang_claim_strength",
          star,
        });
      });
    };
    claimRound([1, 2, 3]);
    assert.equal(game.getPublicState().communityCards.length, 3);
    claimRound([1, 2, 3]);
    assert.equal(game.getPublicState().communityCards.length, 4);
    claimRound([1, 2, 3]);
    assert.equal(game.getPublicState().communityCards.length, 5);
    claimRound([1, 2, 3]);
    assert.equal(game.getPublicState().phase, "PREFLOP");
    assert.equal(game.getPublicState().heistNumber, 2);
  });
});

describe("TheGangGame heists", () => {
  it("records a successful heist when red-chip order matches hand strength", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    setHoleCards(game, P1, [card(2, "clubs"), card(3, "diamonds")]);
    setHoleCards(game, P2, [card(10, "clubs"), card(10, "diamonds")]);
    setHoleCards(game, P3, [card(14, "spades"), card(14, "hearts")]);
    setCommunity(game, [
      card(2, "spades"),
      card(5, "hearts"),
      card(9, "clubs"),
      card(11, "diamonds"),
      card(13, "spades"),
    ]);
    asInternals(game).phase = "RIVER";
    asInternals(game).chipColor = "red";
    assignChips(game, { [P1]: 1, [P2]: 2, [P3]: 3 });
    game.advancePhaseForTests();

    const pub = game.getPublicState();
    assert.equal(pub.lastHeist?.success, true);
    assert.equal(pub.vaultsOpened, 1);
    assert.equal(pub.alarms, 0);
    assert.equal(pub.phase, "PREFLOP");
  });

  it("accepts equal hands in showdown ordering", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    setHoleCards(game, P1, [card(3, "clubs"), card(4, "clubs")]);
    setHoleCards(game, P2, [card(5, "diamonds"), card(6, "diamonds")]);
    setHoleCards(game, P3, [card(9, "spades"), card(8, "spades")]);
    setCommunity(game, [
      card(14, "hearts"),
      card(14, "spades"),
      card(13, "clubs"),
      card(13, "diamonds"),
      card(2, "hearts"),
    ]);
    asInternals(game).phase = "RIVER";
    asInternals(game).chipColor = "red";
    assignChips(game, { [P1]: 1, [P2]: 2, [P3]: 3 });
    game.advancePhaseForTests();

    assert.equal(game.getPublicState().lastHeist?.success, true);
  });

  it("records a failed heist when ordering breaks", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    setHoleCards(game, P1, [card(14, "spades"), card(14, "hearts")]);
    setHoleCards(game, P2, [card(10, "clubs"), card(10, "diamonds")]);
    setHoleCards(game, P3, [card(2, "clubs"), card(3, "diamonds")]);
    setCommunity(game, [
      card(2, "spades"),
      card(5, "hearts"),
      card(9, "clubs"),
      card(11, "diamonds"),
      card(13, "spades"),
    ]);
    asInternals(game).phase = "RIVER";
    asInternals(game).chipColor = "red";
    assignChips(game, { [P1]: 1, [P2]: 2, [P3]: 3 });
    game.advancePhaseForTests();

    assert.equal(game.getPublicState().lastHeist?.success, false);
    assert.equal(game.getPublicState().vaultsOpened, 0);
    assert.equal(game.getPublicState().alarms, 1);
  });

  it("ends the game after 3 vaults", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    for (let heist = 0; heist < 3; heist += 1) {
      setHoleCards(game, P1, [card(2, "clubs"), card(3, "diamonds")]);
      setHoleCards(game, P2, [card(10, "clubs"), card(10, "diamonds")]);
      setHoleCards(game, P3, [card(14, "spades"), card(14, "hearts")]);
      setCommunity(game, [
        card(2, "spades"),
        card(5, "hearts"),
        card(9, "clubs"),
        card(11, "diamonds"),
        card(13, "spades"),
      ]);
      asInternals(game).phase = "RIVER";
      asInternals(game).chipColor = "red";
      assignChips(game, { [P1]: 1, [P2]: 2, [P3]: 3 });
      game.advancePhaseForTests();
    }
    const pub = game.getPublicState();
    assert.equal(pub.phase, "RESULTS");
    assert.equal(pub.endReason, "won");
    assert.equal(pub.vaultsOpened, 3);
  });

  it("ends the game after 3 alarms", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    for (let heist = 0; heist < 3; heist += 1) {
      setHoleCards(game, P1, [card(14, "spades"), card(14, "hearts")]);
      setHoleCards(game, P2, [card(10, "clubs"), card(10, "diamonds")]);
      setHoleCards(game, P3, [card(2, "clubs"), card(3, "diamonds")]);
      setCommunity(game, [
        card(2, "spades"),
        card(5, "hearts"),
        card(9, "clubs"),
        card(11, "diamonds"),
        card(13, "spades"),
      ]);
      asInternals(game).phase = "RIVER";
      asInternals(game).chipColor = "red";
      assignChips(game, { [P1]: 1, [P2]: 2, [P3]: 3 });
      game.advancePhaseForTests();
    }
    const pub = game.getPublicState();
    assert.equal(pub.phase, "RESULTS");
    assert.equal(pub.endReason, "lost");
    assert.equal(pub.alarms, 3);
  });

  it("resets state on replay setup", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    asInternals(game).vaultsOpened = 2;
    asInternals(game).alarms = 1;
    asInternals(game).phase = "RESULTS";
    game.setup([P1, P2, P3]);
    const pub = game.getPublicState();
    assert.equal(pub.phase, "PREFLOP");
    assert.equal(pub.vaultsOpened, 0);
    assert.equal(pub.alarms, 0);
    assert.equal(pub.heistNumber, 1);
  });
});

describe("TheGangGame hidden information", () => {
  it("never exposes another player's hole cards before showdown", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    setHoleCards(game, P1, [card(14, "spades"), card(14, "hearts")]);
    setHoleCards(game, P2, [card(2, "clubs"), card(3, "diamonds")]);
    const p2View = game.getPrivateState(P2).holeCards;
    assert.deepEqual(p2View, [card(2, "clubs"), card(3, "diamonds")]);
    assert.notDeepEqual(p2View, [card(14, "spades"), card(14, "hearts")]);
  });
});

describe("TheGangGame onPlayerRemoved", () => {
  it("advances the phase when the last unclaimed player leaves", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3, P4]);
    game.performAction(P1, { type: "gang_claim_strength", star: 1 });
    game.performAction(P2, { type: "gang_claim_strength", star: 2 });
    game.performAction(P3, { type: "gang_claim_strength", star: 3 });

    game.onPlayerRemoved(P4);

    const pub = game.getPublicState();
    assert.equal(pub.phase, "FLOP");
    assert.equal(pub.chipColor, "yellow");
    assert.equal(pub.communityCards.length, 3);
    assert.equal(pub.chipHeld.length, 0);
  });

  it("reclaims star values above the remaining player count", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3, P4, P5, P6]);
    game.performAction(P1, { type: "gang_claim_strength", star: 6 });
    assert.deepEqual(
      game.getPublicState().chipHeld,
      [{ playerId: P1, star: 6 }],
    );

    game.onPlayerRemoved(P6);

    const pub = game.getPublicState();
    assert.equal(pub.chipHeld.some((entry) => entry.playerId === P1), false);
    assert.equal(pub.chipCenter.includes(6), false);
    assert.deepEqual(pub.chipCenter, [1, 2, 3, 4, 5]);
    assert.equal(pub.playerCount, 5);
  });

  it("frees a claimed position when the holder leaves", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3, P4]);
    game.performAction(P1, { type: "gang_claim_strength", star: 2 });

    game.onPlayerRemoved(P1);

    const pub = game.getPublicState();
    assert.equal(pub.chipHeld.length, 0);
    assert.ok(pub.chipCenter.includes(2));
    assert.equal(pub.phase, "PREFLOP");
  });
});
