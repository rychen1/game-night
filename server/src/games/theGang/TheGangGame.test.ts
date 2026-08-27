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

describe("TheGangGame chip actions", () => {
  it("takes a chip from the center", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_take_center", star: 2 });
    assert.deepEqual(game.getPublicState().chipHeld, [{ playerId: P1, star: 2 }]);
  });

  it("returns a chip to the center", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_take_center", star: 1 });
    game.performAction(P1, { type: "gang_return_chip" });
    assert.equal(game.getPublicState().chipHeld.length, 0);
    assert.ok(game.getPublicState().chipCenter.includes(1));
  });

  it("takes a chip from another player", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_take_center", star: 3 });
    game.performAction(P2, { type: "gang_take_from_player", fromPlayerId: P1 });
    assert.deepEqual(game.getPublicState().chipHeld, [{ playerId: P2, star: 3 }]);
  });

  it("prevents holding two chips of the same color", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_take_center", star: 1 });
    assert.throws(
      () => game.performAction(P1, { type: "gang_take_center", star: 2 }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "Return your current chip before taking another",
    );
  });

  it("advances only when every player holds a chip", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_take_center", star: 1 });
    assert.equal(game.getPublicState().phase, "PREFLOP");
    game.performAction(P2, { type: "gang_take_center", star: 2 });
    game.performAction(P3, { type: "gang_take_center", star: 3 });
    assert.equal(game.getPublicState().phase, "FLOP");
    assert.equal(game.getPublicState().chipColor, "yellow");
    assert.equal(game.getPublicState().communityCards.length, 3);
  });

  it("reveals community cards through flop, turn, and river", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    const takeRound = (stars: number[]) => {
      stars.forEach((star, index) => {
        game.performAction([P1, P2, P3][index]!, {
          type: "gang_take_center",
          star,
        });
      });
    };
    takeRound([1, 2, 3]);
    assert.equal(game.getPublicState().communityCards.length, 3);
    takeRound([1, 2, 3]);
    assert.equal(game.getPublicState().communityCards.length, 4);
    takeRound([1, 2, 3]);
    assert.equal(game.getPublicState().communityCards.length, 5);
    takeRound([1, 2, 3]);
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
