import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameError } from "../Game.ts";
import { TheGangGame } from "./TheGangGame.ts";
import {
  asInternals,
  assignChips,
  card,
  claimRound,
  setActiveModifiers,
  setCommunity,
  setHoleCards,
  setRotatingSpecialist,
  setupFixedOrder,
} from "./testHelpers.ts";

const P1 = "p1";
const P2 = "p2";
const P3 = "p3";

function startWithSpecialist(specialistId: Parameters<typeof setRotatingSpecialist>[1]): TheGangGame {
  const game = new TheGangGame("advanced");
  setupFixedOrder(game, [P1, P2, P3]);
  setRotatingSpecialist(game, specialistId);
  game.startHeistForTests();
  return game;
}

describe("The Gang specialist cards", () => {
  it("assigns Getaway Driver at setup and defers declaration until five cards", () => {
    const game = startWithSpecialist("getawayDriver");
    game.performAction(P1, { type: "gang_take_specialist" });

    let pub = game.getPublicState();
    assert.equal(pub.phase, "PREFLOP");
    assert.equal(pub.getawayDriverAssigneeId, P1);
    assert.equal(
      game.getPrivateState(P1).legalActions.includes("gang_declare_category"),
      false,
    );

    setCommunity(game, [
      card(2, "spades"),
      card(5, "hearts"),
      card(9, "clubs"),
    ]);
    setHoleCards(game, P1, [card(14, "spades"), card(14, "hearts")]);

    assert.equal(
      game.getPrivateState(P1).legalActions.includes("gang_declare_category"),
      true,
    );
    game.performAction(P1, { type: "gang_declare_category", category: "pair" });

    pub = game.getPublicState();
    assert.equal(pub.getawayDriverAssigneeId, undefined);
    assert.equal(pub.getawayDriverDeclaration?.playerId, P1);
    assert.equal(pub.getawayDriverDeclaration?.label, "Pair");
  });

  it("shares one hole card with Informant", () => {
    const game = startWithSpecialist("informant");
    setHoleCards(game, P1, [card(14, "spades"), card(2, "clubs")]);
    game.performAction(P1, { type: "gang_take_specialist" });
    game.performAction(P1, {
      type: "gang_informant",
      targetPlayerId: P2,
      cardIndex: 0,
    });

    const tip = game.getPrivateState(P2).informantCard;
    assert.deepEqual(tip, card(14, "spades"));
    assert.equal(game.getPublicState().phase, "PREFLOP");
  });

  it("records Investor face-card declarations from every player", () => {
    const game = startWithSpecialist("investor");
    setHoleCards(game, P1, [card(13, "spades"), card(2, "clubs")]);
    setHoleCards(game, P2, [card(11, "hearts"), card(12, "diamonds")]);
    setHoleCards(game, P3, [card(5, "clubs"), card(6, "diamonds")]);
    game.performAction(P1, { type: "gang_declare_face_cards", count: 1 });
    game.performAction(P2, { type: "gang_declare_face_cards", count: 2 });
    game.performAction(P3, { type: "gang_declare_face_cards", count: 0 });

    const setup = game.getPublicState().specialistSetup;
    assert.equal(setup, undefined);
    assert.equal(game.getPublicState().phase, "PREFLOP");
  });

  it("records Mastermind rank-count declaration", () => {
    const game = startWithSpecialist("mastermind");
    setHoleCards(game, P1, [card(9, "spades"), card(3, "clubs")]);
    game.performAction(P1, { type: "gang_take_specialist" });
    game.performAction(P1, { type: "gang_declare_rank_count", rank: 9, count: 1 });

    assert.equal(game.getPublicState().phase, "PREFLOP");
  });

  it("draws and discards for Hacker", () => {
    const game = startWithSpecialist("hacker");
    setHoleCards(game, P1, [card(14, "spades"), card(2, "clubs")]);
    game.performAction(P1, { type: "gang_take_specialist" });
    assert.equal(game.getPrivateState(P1).holeCards.length, 3);
    game.performAction(P1, { type: "gang_discard_hole", cardIndex: 2 });

    assert.equal(game.getPrivateState(P1).holeCards.length, 2);
    assert.equal(game.getPublicState().phase, "PREFLOP");
  });

  it("passes cards left for Coordinator", () => {
    const game = startWithSpecialist("coordinator");
    setHoleCards(game, P1, [card(14, "spades"), card(2, "clubs")]);
    setHoleCards(game, P2, [card(10, "hearts"), card(9, "diamonds")]);
    setHoleCards(game, P3, [card(5, "clubs"), card(6, "diamonds")]);
    game.performAction(P1, { type: "gang_coordinator_pass", cardIndex: 1 });
    game.performAction(P2, { type: "gang_coordinator_pass", cardIndex: 0 });
    game.performAction(P3, { type: "gang_coordinator_pass", cardIndex: 0 });

    assert.deepEqual(game.getPrivateState(P2).holeCards, [
      card(9, "diamonds"),
      card(2, "clubs"),
    ]);
    assert.deepEqual(game.getPrivateState(P3).holeCards, [
      card(6, "diamonds"),
      card(10, "hearts"),
    ]);
    assert.deepEqual(game.getPrivateState(P1).holeCards, [
      card(14, "spades"),
      card(5, "clubs"),
    ]);
  });

  it("adds Jack specialist card and discards for Jack", () => {
    const game = startWithSpecialist("jack");
    setHoleCards(game, P1, [card(14, "spades"), card(2, "clubs")]);
    game.performAction(P1, { type: "gang_take_specialist" });
    assert.equal(game.getPrivateState(P1).holeCards.some((c) => c.jackSpecialist), true);
    game.performAction(P1, { type: "gang_discard_hole", cardIndex: 0 });

    assert.equal(game.getPrivateState(P1).holeCards.length, 2);
    assert.equal(game.getPrivateState(P1).holeCards.some((c) => c.jackSpecialist), true);
  });

  it("records Math Whiz sums from every player", () => {
    const game = startWithSpecialist("mathWhiz");
    setHoleCards(game, P1, [card(10, "spades"), card(7, "clubs")]);
    setHoleCards(game, P2, [card(12, "hearts"), card(3, "diamonds")]);
    setHoleCards(game, P3, [card(14, "clubs"), card(10, "diamonds")]);
    game.performAction(P1, { type: "gang_declare_math_sum", sum: 17 });
    game.performAction(P2, { type: "gang_declare_math_sum", sum: 13 });
    game.performAction(P3, { type: "gang_declare_math_sum", sum: 21 });

    assert.equal(game.getPublicState().phase, "PREFLOP");
  });

  it("redistributes hole cards for Conwoman", () => {
    const game = new TheGangGame("advanced");
    setupFixedOrder(game, [P1, P2, P3]);
    setRotatingSpecialist(game, "conwoman");
    game.startHeistForTests();

    const allCards = [P1, P2, P3].flatMap(
      (playerId) => game.getPrivateState(playerId).holeCards,
    );
    assert.equal(allCards.length, 6);
    assert.equal(game.getPublicState().phase, "PREFLOP");
  });

  it("sets Muscle assignee for the heist", () => {
    const game = startWithSpecialist("muscle");
    game.performAction(P1, { type: "gang_take_specialist" });

    assert.equal(game.getPublicState().musclePlayerId, P1);
    assert.equal(game.getPublicState().phase, "PREFLOP");
  });
});

describe("The Gang showdown gates", () => {
  it("fails the heist when Retina Scan guess is wrong", () => {
    const game = new TheGangGame("advanced");
    setupFixedOrder(game, [P1, P2, P3]);
    setActiveModifiers(game, [{ kind: "challenge", id: "retinaScan" }]);
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

    assert.equal(game.getPublicState().phase, "SHOWDOWN_GATE");
    game.performAction(P1, { type: "gang_guess_pocket_rank", rank: 2 });
    game.performAction(P2, { type: "gang_guess_pocket_rank", rank: 2 });
    game.advancePhaseForTests();

    const pub = game.getPublicState();
    assert.equal(pub.lastHeist?.success, false);
    assert.equal(pub.alarms, 1);
  });

  it("passes Retina Scan when the agreed rank is in the target pocket", () => {
    const game = new TheGangGame("advanced");
    setupFixedOrder(game, [P1, P2, P3]);
    setActiveModifiers(game, [{ kind: "challenge", id: "retinaScan" }]);
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

    game.performAction(P1, { type: "gang_guess_pocket_rank", rank: 14 });
    game.performAction(P2, { type: "gang_guess_pocket_rank", rank: 14 });
    game.advancePhaseForTests();

    const pub = game.getPublicState();
    assert.equal(pub.lastHeist?.success, true);
    assert.equal(pub.vaultsOpened, 1);
  });

  it("fails the heist when Fingerprint Scan guess is wrong", () => {
    const game = new TheGangGame("advanced");
    setupFixedOrder(game, [P1, P2, P3]);
    setActiveModifiers(game, [{ kind: "challenge", id: "fingerprintScan" }]);
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

    game.performAction(P1, { type: "gang_guess_hand_category", category: "high_card" });
    game.performAction(P2, { type: "gang_guess_hand_category", category: "high_card" });
    game.advancePhaseForTests();

    assert.equal(game.getPublicState().lastHeist?.success, false);
  });

  it("passes Fingerprint Scan when the agreed category matches", () => {
    const game = new TheGangGame("advanced");
    setupFixedOrder(game, [P1, P2, P3]);
    setActiveModifiers(game, [{ kind: "challenge", id: "fingerprintScan" }]);
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

    game.performAction(P1, { type: "gang_guess_hand_category", category: "pair" });
    game.performAction(P2, { type: "gang_guess_hand_category", category: "pair" });
    game.advancePhaseForTests();

    assert.equal(game.getPublicState().lastHeist?.success, true);
  });
});

describe("The Gang challenge side effects", () => {
  it("redraws hole cards for Motion Detector when the flop has a face card", () => {
    const game = new TheGangGame("advanced");
    setupFixedOrder(game, [P1, P2, P3]);
    setActiveModifiers(game, [{ kind: "challenge", id: "motionDetector" }]);
    setHoleCards(game, P1, [card(14, "spades"), card(14, "hearts")]);
    setHoleCards(game, P2, [card(10, "clubs"), card(10, "diamonds")]);
    setHoleCards(game, P3, [card(2, "clubs"), card(3, "diamonds")]);
    game.startHeistForTests();
    asInternals(game).deck = [
      card(13, "spades"),
      card(12, "hearts"),
      card(11, "diamonds"),
      ...asInternals(game).deck,
    ];

    claimRound(game, [P1, P2, P3], [1, 2, 3]);

    const redrawn = game.getPrivateState(P1).holeCards;
    assert.notDeepEqual(redrawn, [card(14, "spades"), card(14, "hearts")]);
    assert.equal(redrawn.length, 2);
  });

  it("redraws hole cards for Laser Tripwires when the flop has no face card", () => {
    const game = new TheGangGame("advanced");
    setupFixedOrder(game, [P1, P2, P3]);
    setActiveModifiers(game, [{ kind: "challenge", id: "laserTripwires" }]);
    setHoleCards(game, P1, [card(14, "spades"), card(14, "hearts")]);
    setHoleCards(game, P2, [card(10, "clubs"), card(10, "diamonds")]);
    setHoleCards(game, P3, [card(2, "clubs"), card(3, "diamonds")]);
    game.startHeistForTests();
    asInternals(game).deck = [
      card(2, "spades"),
      card(5, "hearts"),
      card(9, "clubs"),
      ...asInternals(game).deck,
    ];

    claimRound(game, [P3, P2, P1], [1, 2, 3]);

    const redrawn = game.getPrivateState(P3).holeCards;
    assert.notDeepEqual(redrawn, [card(2, "clubs"), card(3, "diamonds")]);
  });

  it("releases a claimed position back to the center", () => {
    const game = new TheGangGame();
    setupFixedOrder(game, [P1, P2, P3]);
    game.performAction(P1, { type: "gang_claim_strength", star: 2 });
    game.performAction(P1, { type: "gang_release_strength" });

    const pub = game.getPublicState();
    assert.equal(pub.chipHeld.length, 0);
    assert.ok(pub.chipCenter.includes(2));
  });

  it("rejects Getaway Driver declaration before five cards are available", () => {
    const game = startWithSpecialist("getawayDriver");
    game.performAction(P1, { type: "gang_take_specialist" });
    assert.throws(
      () => game.performAction(P1, { type: "gang_declare_category", category: "pair" }),
      (error: unknown) =>
        error instanceof GameError &&
        error.message === "Not enough cards to evaluate your hand yet",
    );
  });
});
