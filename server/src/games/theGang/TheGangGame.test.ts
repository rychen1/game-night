import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameError } from "../Game.ts";
import { TheGangGame } from "./TheGangGame.ts";
import {
  asInternals,
  assignChips,
  card,
  setActiveModifiers,
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

  it("switches to a different unclaimed position atomically", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_claim_strength", star: 1 });
    game.performAction(P1, { type: "gang_claim_strength", star: 3 });

    const pub = game.getPublicState();
    assert.deepEqual(pub.chipHeld, [{ playerId: P1, star: 3 }]);
    assert.ok(pub.chipCenter.includes(1));
    assert.equal(pub.chipCenter.includes(3), false);
    assert.equal(asInternals(game).chipHeld.size, 1);
  });

  it("releases a claim when the holder claims their current position again", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_claim_strength", star: 2 });
    game.performAction(P1, { type: "gang_claim_strength", star: 2 });

    assert.equal(game.getPublicState().chipHeld.length, 0);
    assert.ok(game.getPublicState().chipCenter.includes(2));
  });

  it("releases a strength claim via gang_release_strength", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_claim_strength", star: 1 });
    game.performAction(P1, { type: "gang_release_strength" });
    assert.equal(game.getPublicState().chipHeld.length, 0);
    assert.ok(game.getPublicState().chipCenter.includes(1));
  });

  it("steals a strength position from another player", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_claim_strength", star: 3 });
    game.performAction(P2, { type: "gang_claim_strength", star: 3 });

    const pub = game.getPublicState();
    assert.deepEqual(pub.chipHeld, [{ playerId: P2, star: 3 }]);
    assert.ok(pub.chipCenter.includes(1));
    assert.ok(pub.chipCenter.includes(2));
  });

  it("returns the thief's old position to the center when stealing", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_claim_strength", star: 1 });
    game.performAction(P2, { type: "gang_claim_strength", star: 3 });
    game.performAction(P1, { type: "gang_claim_strength", star: 3 });

    const pub = game.getPublicState();
    assert.deepEqual(pub.chipHeld, [{ playerId: P1, star: 3 }]);
    assert.ok(pub.chipCenter.includes(1));
    assert.ok(pub.chipCenter.includes(2));
  });

  it("does not advance the phase when a steal leaves a player without a position", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_claim_strength", star: 1 });
    game.performAction(P2, { type: "gang_claim_strength", star: 2 });
    game.performAction(P1, { type: "gang_claim_strength", star: 2 });

    const pub = game.getPublicState();
    assert.equal(pub.phase, "PREFLOP");
    assert.deepEqual(pub.chipHeld, [{ playerId: P1, star: 2 }]);
    assert.deepEqual(pub.chipCenter.sort(), [1, 3]);
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

describe("TheGangGame modes and modifiers", () => {
  it("exposes mode and alarm limit in public state", () => {
    const game = new TheGangGame("masterThief");
    setupFixedOrder(game, [P1, P2, P3]);
    const pub = game.getPublicState();
    assert.equal(pub.mode, "masterThief");
    assert.equal(pub.alarmsToLose, 2);
    assert.equal(pub.activeModifiers.length, 2);
    assert.ok(pub.activeModifiers.every((modifier) => !modifier.permanent));
    assert.deepEqual(
      pub.activeModifiers.map((modifier) => modifier.id).sort(),
      ["motionDetector", "noiseSensors"],
    );
  });

  it("starts with no modifiers in basic mode", () => {
    const game = new TheGangGame("basic");
    setupFixedOrder(game, [P1, P2, P3]);
    assert.equal(game.getPublicState().activeModifiers.length, 0);
  });

  it("adds a permanent challenge in professional mode", () => {
    const game = new TheGangGame("professional");
    setupFixedOrder(game, [P1, P2, P3]);
    const pub = game.getPublicState();
    assert.equal(pub.activeModifiers.length, 1);
    assert.equal(pub.activeModifiers[0]?.kind, "challenge");
    assert.equal(pub.activeModifiers[0]?.permanent, true);
    assert.equal(pub.activeModifiers[0]?.id, "noiseSensors");
  });

  it("keeps the permanent challenge and adds a rotating one after success in professional mode", () => {
    const game = new TheGangGame("professional");
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
    assert.equal(pub.heistNumber, 2);
    assert.equal(pub.activeModifiers.length, 2);
    assert.equal(pub.activeModifiers[0]?.id, "noiseSensors");
    assert.equal(pub.activeModifiers[0]?.permanent, true);
    assert.equal(pub.activeModifiers[1]?.kind, "challenge");
    assert.equal(pub.activeModifiers[1]?.id, "motionDetector");
    assert.equal(pub.activeModifiers[1]?.permanent, undefined);
  });

  it("keeps the permanent challenge and adds a specialist after failure in professional mode", () => {
    const game = new TheGangGame("professional");
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

    const pub = game.getPublicState();
    assert.equal(pub.alarms, 1);
    assert.equal(pub.activeModifiers.length, 2);
    assert.equal(pub.activeModifiers[0]?.id, "noiseSensors");
    assert.equal(pub.activeModifiers[0]?.permanent, true);
    assert.equal(pub.activeModifiers[1]?.kind, "specialist");
    assert.equal(pub.activeModifiers[1]?.id, "informant");
  });

  it("rotates challenges between heists in master thief mode", () => {
    const game = new TheGangGame("masterThief");
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
    assert.equal(pub.heistNumber, 2);
    assert.equal(pub.activeModifiers.length, 2);
    assert.deepEqual(
      pub.activeModifiers.map((modifier) => modifier.id).sort(),
      ["motionDetector", "retinaScan"],
    );
  });

  it("does not add a third challenge after success in master thief mode", () => {
    const game = new TheGangGame("masterThief");
    setupFixedOrder(game, [P1, P2, P3]);
    for (let heist = 0; heist < 2; heist += 1) {
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
    assert.equal(game.getPublicState().activeModifiers.length, 2);
    assert.ok(
      game.getPublicState().activeModifiers.every((modifier) => modifier.kind === "challenge"),
    );
  });

  it("activates a challenge after a successful heist in advanced mode", () => {
    const game = new TheGangGame("advanced");
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
    assert.equal(pub.heistNumber, 2);
    assert.equal(pub.activeModifiers.length, 1);
    assert.equal(pub.activeModifiers[0]?.kind, "challenge");
    assert.equal(pub.activeModifiers[0]?.id, "quickAccess");
  });

  it("activates a specialist after a failed heist in advanced mode", () => {
    const game = new TheGangGame("advanced");
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

    const pub = game.getPublicState();
    assert.equal(pub.alarms, 1);
    assert.equal(pub.activeModifiers.length, 1);
    assert.equal(pub.activeModifiers[0]?.kind, "specialist");
    assert.equal(pub.activeModifiers[0]?.id, "informant");
  });

  it("ends the game after two alarms in master thief mode", () => {
    const game = new TheGangGame("masterThief");
    setupFixedOrder(game, [P1, P2, P3]);
    for (let heist = 0; heist < 2; heist += 1) {
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
      while (game.getPublicState().phase === "SHOWDOWN_GATE") {
        game.advancePhaseForTests();
      }
    }
    const pub = game.getPublicState();
    assert.equal(pub.phase, "RESULTS");
    assert.equal(pub.endReason, "lost");
    assert.equal(pub.alarms, 2);
  });

  it("skips the turn street when Hasty Getaway is active", () => {
    const game = new TheGangGame("advanced");
    setupFixedOrder(game, [P1, P2, P3]);
    setActiveModifiers(game, [{ kind: "challenge", id: "hastyGetaway" }]);

    const claimRound = (stars: number[]) => {
      stars.forEach((star, index) => {
        game.performAction([P1, P2, P3][index]!, {
          type: "gang_claim_strength",
          star,
        });
      });
    };

    claimRound([1, 2, 3]);
    assert.equal(game.getPublicState().phase, "FLOP");
    assert.equal(game.getPublicState().communityCards.length, 3);

    claimRound([1, 2, 3]);
    const pub = game.getPublicState();
    assert.equal(pub.phase, "RIVER");
    assert.equal(pub.chipColor, "red");
    assert.equal(pub.communityCards.length, 4);
    assert.equal(pub.chipHistory.length, 2);
    assert.equal(pub.chipHistory.some((entry) => entry.color === "orange"), false);
  });

  it("skips pre-flop when Quick Access is active", () => {
    const game = new TheGangGame("advanced");
    setupFixedOrder(game, [P1, P2, P3]);
    setActiveModifiers(game, [{ kind: "challenge", id: "quickAccess" }]);
    game.startHeistForTests();

    const pub = game.getPublicState();
    assert.equal(pub.phase, "FLOP");
    assert.equal(pub.chipColor, "yellow");
    assert.equal(pub.communityCards.length, 3);
  });

  it("deals three hole cards with Security Cameras", () => {
    const game = new TheGangGame("advanced");
    setupFixedOrder(game, [P1, P2, P3]);
    setActiveModifiers(game, [{ kind: "challenge", id: "securityCameras" }]);
    game.startHeistForTests();

    assert.equal(game.getPrivateState(P1).holeCards.length, 3);
  });

  it("locks the 1-star chip under Noise Sensors", () => {
    const game = new TheGangGame("advanced");
    setupFixedOrder(game, [P1, P2, P3]);
    setActiveModifiers(game, [{ kind: "challenge", id: "noiseSensors" }]);
    game.startHeistForTests();
    game.performAction(P1, { type: "gang_claim_strength", star: 1 });
    assert.throws(
      () => game.performAction(P2, { type: "gang_claim_strength", star: 1 }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "That strength position is locked",
    );
  });

  it("enters modifier setup after a failed heist with a specialist", () => {
    const game = new TheGangGame("advanced");
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

    assert.equal(game.getPublicState().phase, "MODIFIER_SETUP");
    assert.equal(game.getPublicState().specialistSetup?.specialistId, "informant");
  });
});
