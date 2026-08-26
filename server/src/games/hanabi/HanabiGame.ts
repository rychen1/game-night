import type {
  GameAction,
  HanabiActionType,
  HanabiCardView,
  HanabiClue,
  HanabiColor,
  HanabiEndReason,
  HanabiKnowledge,
  HanabiLogEntry,
  HanabiPhase,
  HanabiPrivateState,
  HanabiPublicCard,
  HanabiPublicState,
  HanabiRank,
} from "../../protocol/messages.ts";
import { GameError, type Game } from "../Game.ts";
import {
  HANABI_COLORS,
  buildShuffledDeck,
  emptyStacks,
  handSizeFor,
  type PhysicalCard,
} from "./deck.ts";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 5;
const MAX_CLUES = 8;
const STARTING_FUSES = 3;

function emptyKnowledge(): HanabiKnowledge {
  return { notColors: [], notRanks: [] };
}

function cloneKnowledge(knowledge: HanabiKnowledge): HanabiKnowledge {
  const next: HanabiKnowledge = {
    notColors: [...knowledge.notColors],
    notRanks: [...knowledge.notRanks],
  };
  if (knowledge.knownColor) {
    next.knownColor = knowledge.knownColor;
  }
  if (knowledge.knownRank) {
    next.knownRank = knowledge.knownRank;
  }
  return next;
}

function publicCard(card: PhysicalCard): HanabiPublicCard {
  return { color: card.color, rank: card.rank };
}

export class HanabiGame implements Game {
  private phase: HanabiPhase = "PLAYING";
  private order: string[] = [];
  private turnIndex = 0;
  private cards = new Map<string, PhysicalCard>();
  private deck: string[] = [];
  private hands = new Map<string, string[]>();
  private knowledge = new Map<string, HanabiKnowledge>();
  private stacks: Record<HanabiColor, number> = emptyStacks();
  private discard: HanabiPublicCard[] = [];
  private clueTokens = MAX_CLUES;
  private fuseTokens = STARTING_FUSES;
  private finalTurnsLeft: number | null = null;
  private log: HanabiLogEntry[] = [];
  private endReason: HanabiEndReason | undefined;

  canStart(playerCount: number): string | null {
    if (playerCount < MIN_PLAYERS) {
      return `Hanabi needs at least ${MIN_PLAYERS} players`;
    }
    if (playerCount > MAX_PLAYERS) {
      return `Hanabi supports at most ${MAX_PLAYERS} players`;
    }
    return null;
  }

  setup(playerIds: string[]): void {
    const shuffled = buildShuffledDeck();
    this.cards = new Map(shuffled.map((card) => [card.cardId, card]));
    this.deck = shuffled.map((card) => card.cardId);
    this.order = [...playerIds];
    for (let i = this.order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const a = this.order[i];
      const b = this.order[j];
      if (a === undefined || b === undefined) {
        continue;
      }
      this.order[i] = b;
      this.order[j] = a;
    }
    this.turnIndex = 0;
    this.stacks = emptyStacks();
    this.discard = [];
    this.clueTokens = MAX_CLUES;
    this.fuseTokens = STARTING_FUSES;
    this.finalTurnsLeft = null;
    this.log = [];
    this.endReason = undefined;
    this.phase = "PLAYING";
    this.knowledge = new Map();
    this.hands = new Map();

    const size = handSizeFor(this.order.length);
    for (const playerId of this.order) {
      const hand: string[] = [];
      for (let i = 0; i < size; i += 1) {
        const cardId = this.drawFromDeck();
        if (!cardId) {
          throw new GameError("Deck ran out while dealing");
        }
        hand.push(cardId);
      }
      this.hands.set(playerId, hand);
    }
  }

  getPublicState(): HanabiPublicState {
    const handSizes: Record<string, number> = {};
    for (const playerId of this.order) {
      handSizes[playerId] = this.hands.get(playerId)?.length ?? 0;
    }
    const state: HanabiPublicState = {
      kind: "hanabi",
      phase: this.phase,
      currentPlayerId: this.order[this.turnIndex] ?? "",
      order: [...this.order],
      handSizes,
      stacks: { ...this.stacks },
      discard: this.discard.map((card) => ({ ...card })),
      clueTokens: this.clueTokens,
      fuseTokens: this.fuseTokens,
      deckCount: this.deck.length,
      finalTurnsLeft: this.finalTurnsLeft,
      log: this.log.map((entry) => ({ ...entry })),
    };
    if (this.endReason) {
      state.endReason = this.endReason;
    }
    if (this.phase === "RESULTS") {
      state.score = this.score();
    }
    return state;
  }

  getPrivateState(viewerId: string): HanabiPrivateState {
    const hands: Record<string, HanabiCardView[]> = {};
    for (const ownerId of this.order) {
      const cardIds = this.hands.get(ownerId) ?? [];
      hands[ownerId] = cardIds.map((cardId) =>
        this.projectCard(viewerId, ownerId, cardId),
      );
    }
    return {
      kind: "hanabi",
      hands,
      legalActions: this.legalActions(viewerId),
    };
  }

  performAction(playerId: string, action: GameAction): void {
    if (!this.hands.has(playerId)) {
      throw new GameError("You are not in this game");
    }
    if (this.isGameOver()) {
      throw new GameError("The game is over");
    }
    switch (action.type) {
      case "give_clue":
        this.giveClue(playerId, action.targetPlayerId, action.clue);
        return;
      case "play_card":
        this.playCard(playerId, action.cardId);
        return;
      case "discard_card":
        this.discardCard(playerId, action.cardId);
        return;
      default:
        throw new GameError("That action is not valid in this game");
    }
  }

  onPlayerRemoved(playerId: string): void {
    if (this.isGameOver() || !this.hands.has(playerId)) {
      return;
    }
    this.phase = "ABORTED";
    this.endReason = "aborted";
  }

  isGameOver(): boolean {
    return this.phase === "RESULTS" || this.phase === "ABORTED";
  }

  getTimerDeadline(): number | null {
    return null;
  }

  onTimer(): void {}

  private legalActions(playerId: string): HanabiActionType[] {
    if (this.phase !== "PLAYING") {
      return [];
    }
    if (this.currentPlayerId() !== playerId) {
      return [];
    }
    const actions: HanabiActionType[] = ["play_card"];
    if (this.clueTokens > 0 && this.order.length > 1) {
      actions.push("give_clue");
    }
    if (this.clueTokens < MAX_CLUES) {
      actions.push("discard_card");
    }
    return actions;
  }

  private currentPlayerId(): string {
    return this.order[this.turnIndex] ?? "";
  }

  private projectCard(
    viewerId: string,
    ownerId: string,
    cardId: string,
  ): HanabiCardView {
    const card = this.requireCard(cardId);
    const knowledge = cloneKnowledge(
      this.knowledge.get(cardId) ?? emptyKnowledge(),
    );
    const hideFace = viewerId === ownerId && this.phase === "PLAYING";
    if (hideFace) {
      return { cardId, knowledge };
    }
    return {
      cardId,
      knowledge,
      color: card.color,
      rank: card.rank,
    };
  }

  private giveClue(
    playerId: string,
    targetPlayerId: string,
    clue: HanabiClue,
  ): void {
    this.assertTurn(playerId);
    if (targetPlayerId === playerId) {
      throw new GameError("You cannot clue yourself");
    }
    if (!this.hands.has(targetPlayerId)) {
      throw new GameError("That player is not in this game");
    }
    if (this.clueTokens <= 0) {
      throw new GameError("No clue tokens left");
    }
    const hand = this.hands.get(targetPlayerId) ?? [];
    const matches = hand.filter((cardId) =>
      this.cardMatchesClue(this.requireCard(cardId), clue),
    );
    if (matches.length === 0) {
      throw new GameError("A clue must touch at least one card");
    }

    this.clueTokens -= 1;
    for (const cardId of hand) {
      this.applyClueToCard(cardId, clue);
    }
    this.log.push({
      type: "clue",
      actorId: playerId,
      targetId: targetPlayerId,
      clue: { ...clue },
    });
    this.finishTurn(false);
  }

  private playCard(playerId: string, cardId: string): void {
    this.assertTurn(playerId);
    const card = this.takeFromHand(playerId, cardId);
    const expected = this.stacks[card.color] + 1;
    if (card.rank === expected) {
      this.stacks[card.color] = card.rank;
      if (card.rank === 5) {
        this.restoreClue();
      }
      this.log.push({
        type: "play",
        actorId: playerId,
        card: publicCard(card),
        success: true,
      });
      if (this.isPerfect()) {
        this.end("perfect");
        return;
      }
    } else {
      this.discard.push(publicCard(card));
      this.fuseTokens -= 1;
      this.log.push({
        type: "play",
        actorId: playerId,
        card: publicCard(card),
        success: false,
      });
      if (this.fuseTokens <= 0) {
        this.end("fuses");
        return;
      }
    }
    this.afterCardLeftHand(playerId);
  }

  private discardCard(playerId: string, cardId: string): void {
    this.assertTurn(playerId);
    if (this.clueTokens >= MAX_CLUES) {
      throw new GameError("Cannot discard when clue tokens are full");
    }
    const card = this.takeFromHand(playerId, cardId);
    this.discard.push(publicCard(card));
    this.restoreClue();
    this.log.push({
      type: "discard",
      actorId: playerId,
      card: publicCard(card),
    });
    this.afterCardLeftHand(playerId);
  }

  private afterCardLeftHand(playerId: string): void {
    const emptiedDeck = this.tryDraw(playerId);
    let startedCountdown = false;
    if (emptiedDeck && this.finalTurnsLeft === null) {
      this.finalTurnsLeft = this.order.length;
      startedCountdown = true;
    }
    this.finishTurn(startedCountdown);
  }

  private finishTurn(startedCountdownThisTurn: boolean): void {
    if (this.phase !== "PLAYING") {
      return;
    }
    if (!startedCountdownThisTurn && this.finalTurnsLeft !== null) {
      this.finalTurnsLeft -= 1;
      if (this.finalTurnsLeft <= 0) {
        this.end("deck");
        return;
      }
    }
    this.turnIndex = (this.turnIndex + 1) % this.order.length;
  }

  private tryDraw(playerId: string): boolean {
    const cardId = this.drawFromDeck();
    if (!cardId) {
      return false;
    }
    const hand = this.hands.get(playerId);
    if (!hand) {
      return false;
    }
    hand.push(cardId);
    return this.deck.length === 0;
  }

  private drawFromDeck(): string | undefined {
    const cardId = this.deck.pop();
    if (!cardId) {
      return undefined;
    }
    this.knowledge.set(cardId, emptyKnowledge());
    return cardId;
  }

  private takeFromHand(playerId: string, cardId: string): PhysicalCard {
    const hand = this.hands.get(playerId);
    if (!hand) {
      throw new GameError("You are not in this game");
    }
    const index = hand.indexOf(cardId);
    if (index < 0) {
      throw new GameError("That card is not in your hand");
    }
    hand.splice(index, 1);
    this.knowledge.delete(cardId);
    return this.requireCard(cardId);
  }

  private applyClueToCard(cardId: string, clue: HanabiClue): void {
    const card = this.requireCard(cardId);
    const knowledge = this.knowledge.get(cardId) ?? emptyKnowledge();
    if (clue.type === "color") {
      if (card.color === clue.value) {
        knowledge.knownColor = clue.value;
      } else if (!knowledge.notColors.includes(clue.value)) {
        knowledge.notColors.push(clue.value);
      }
    } else if (card.rank === clue.value) {
      knowledge.knownRank = clue.value;
    } else if (!knowledge.notRanks.includes(clue.value)) {
      knowledge.notRanks.push(clue.value);
    }
    this.knowledge.set(cardId, knowledge);
  }

  private cardMatchesClue(card: PhysicalCard, clue: HanabiClue): boolean {
    return clue.type === "color"
      ? card.color === clue.value
      : card.rank === clue.value;
  }

  private assertTurn(playerId: string): void {
    if (this.phase !== "PLAYING") {
      throw new GameError("The game is not in play");
    }
    if (this.currentPlayerId() !== playerId) {
      throw new GameError("It is not your turn");
    }
  }

  private restoreClue(): void {
    if (this.clueTokens < MAX_CLUES) {
      this.clueTokens += 1;
    }
  }

  private isPerfect(): boolean {
    return HANABI_COLORS.every((color) => this.stacks[color] === 5);
  }

  private score(): number {
    return HANABI_COLORS.reduce((sum, color) => sum + this.stacks[color], 0);
  }

  private end(reason: HanabiEndReason): void {
    this.phase = "RESULTS";
    this.endReason = reason;
  }

  private requireCard(cardId: string): PhysicalCard {
    const card = this.cards.get(cardId);
    if (!card) {
      throw new GameError("Unknown card");
    }
    return card;
  }
}
