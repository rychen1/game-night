import type {
  CrewActionType,
  CrewAttribute,
  CrewCardView,
  CrewCommunicableOption,
  CrewCommunicationMarker,
  CrewCompletedTrick,
  CrewEndReason,
  CrewPhase,
  CrewPrivateState,
  CrewPublicState,
  CrewSignal,
  CrewTrickPlay,
  GameAction,
} from "../../protocol/messages.ts";
import { GameError, type Game } from "../Game.ts";
import {
  buildShuffledDeck,
  handSizesFor,
  publicCard,
  trickWinnerIndex,
  type PhysicalCard,
} from "./deck.ts";
import {
  evaluateTasks,
  markUndealtCardOutcomes,
  missionResultIfFullyDecided,
  pickStarterMission,
  resolveTasks,
  type CrewMissionDef,
  type ResolvedTask,
} from "./missions.ts";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 5;

export class CrewGame implements Game {
  private phase: CrewPhase = "TASKS";
  private order: string[] = [];
  private turnIndex = 0;
  private cards = new Map<string, PhysicalCard>();
  private hands = new Map<string, string[]>();
  private currentTrick: { playerId: string; cardId: string }[] = [];
  private completedTricks: CrewCompletedTrick[] = [];
  private communications: CrewCommunicationMarker[] = [];
  private communicatedPlayers = new Set<string>();
  private mission: CrewMissionDef | null = null;
  private tasks: ResolvedTask[] = [];
  private endReason: CrewEndReason | undefined;

  canStart(playerCount: number): string | null {
    if (playerCount < MIN_PLAYERS) {
      return `The Crew needs at least ${MIN_PLAYERS} players`;
    }
    if (playerCount > MAX_PLAYERS) {
      return `The Crew supports at most ${MAX_PLAYERS} players`;
    }
    return null;
  }

  setup(playerIds: string[]): void {
    const shuffled = buildShuffledDeck();
    this.cards = new Map(shuffled.map((card) => [card.cardId, card]));
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
    this.currentTrick = [];
    this.completedTricks = [];
    this.communications = [];
    this.communicatedPlayers = new Set();
    this.endReason = undefined;
    this.phase = "TASKS";
    this.hands = new Map();

    const sizes = handSizesFor(this.order.length);
    let deckIndex = 0;
    for (let seat = 0; seat < this.order.length; seat += 1) {
      const playerId = this.order[seat];
      if (playerId === undefined) {
        continue;
      }
      const size = sizes[seat] ?? 0;
      const hand: string[] = [];
      for (let i = 0; i < size; i += 1) {
        const card = shuffled[deckIndex];
        deckIndex += 1;
        if (!card) {
          throw new GameError("Deck ran out while dealing");
        }
        hand.push(card.cardId);
      }
      this.hands.set(playerId, hand);
    }

    this.mission = pickStarterMission();
    this.tasks = markUndealtCardOutcomes(
      resolveTasks(this.mission, this.order),
      this.dealtPublicCards(),
    );
  }

  private dealtPublicCards(): { color: PhysicalCard["color"]; rank: PhysicalCard["rank"] }[] {
    const dealt: { color: PhysicalCard["color"]; rank: PhysicalCard["rank"] }[] =
      [];
    for (const hand of this.hands.values()) {
      for (const cardId of hand) {
        const card = this.cards.get(cardId);
        if (card) {
          dealt.push({ color: card.color, rank: card.rank });
        }
      }
    }
    return dealt;
  }

  getPublicState(): CrewPublicState {
    const handSizes: Record<string, number> = {};
    for (const playerId of this.order) {
      handSizes[playerId] = this.hands.get(playerId)?.length ?? 0;
    }
    const currentPlayerId = this.order[this.turnIndex] ?? this.order[0] ?? "";
    const mission = this.mission;
    const state: CrewPublicState = {
      kind: "crew",
      phase: this.phase,
      mission: {
        id: mission?.id ?? "",
        title: mission?.title ?? "Mission",
        description: mission?.description ?? "",
      },
      tasks: this.tasks.map((task) => ({
        id: task.id,
        description: task.description,
        status: task.status,
      })),
      order: [...this.order],
      currentPlayerId,
      trumpColor: "submarine",
      handSizes,
      currentTrick: this.currentTrick.map((play) => {
        const card = this.requireCard(play.cardId);
        return { playerId: play.playerId, card: publicCard(card) };
      }),
      completedTricks: this.completedTricks.map((trick) => ({
        winnerId: trick.winnerId,
        plays: trick.plays.map((play) => ({
          playerId: play.playerId,
          card: { ...play.card },
        })),
      })),
      communications: this.communications.map((marker) => ({ ...marker })),
    };
    if (this.endReason) {
      state.endReason = this.endReason;
    }
    if (this.phase === "RESULTS" || this.phase === "ABORTED") {
      const finalHands: Record<string, { color: PhysicalCard["color"]; rank: PhysicalCard["rank"] }[]> =
        {};
      for (const playerId of this.order) {
        const hand = this.hands.get(playerId) ?? [];
        finalHands[playerId] = hand.map((cardId) =>
          publicCard(this.requireCard(cardId)),
        );
      }
      state.finalHands = finalHands;
    }
    return state;
  }

  getPrivateState(playerId: string): CrewPrivateState {
    const handIds = this.hands.get(playerId) ?? [];
    const hand: CrewCardView[] = handIds.map((cardId) => {
      const card = this.requireCard(cardId);
      return { cardId, color: card.color, rank: card.rank };
    });
    const legalActions = this.legalActionsFor(playerId);
    const state: CrewPrivateState = {
      kind: "crew",
      hand,
      legalActions,
    };
    if (legalActions.includes("crew_play_card")) {
      state.playableCardIds = this.playableCardIds(playerId);
    }
    if (legalActions.includes("crew_communicate")) {
      state.communicableOptions = this.communicableOptions(playerId);
    }
    return state;
  }

  performAction(playerId: string, action: GameAction): void {
    if (!this.hands.has(playerId)) {
      throw new GameError("You are not in this game");
    }
    if (this.isGameOver()) {
      throw new GameError("The game is over");
    }
    switch (action.type) {
      case "crew_begin_mission":
        this.beginMission(playerId);
        return;
      case "crew_play_card":
        this.playCard(playerId, action.cardId);
        return;
      case "crew_communicate":
        this.communicate(
          playerId,
          action.cardId,
          action.signal,
          action.attribute,
        );
        return;
      default:
        throw new GameError("That action is not valid in this game");
    }
  }

  onPlayerRemoved(_playerId: string): void {
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

  private beginMission(playerId: string): void {
    if (this.phase !== "TASKS") {
      throw new GameError("The mission has already begun");
    }
    if (!this.hands.has(playerId)) {
      throw new GameError("You are not in this game");
    }
    const decided = missionResultIfFullyDecided(this.tasks);
    if (decided) {
      this.phase = "RESULTS";
      this.endReason = decided;
      return;
    }
    this.phase = "PLAYING";
  }

  private playCard(playerId: string, cardId: string): void {
    if (this.phase !== "PLAYING") {
      throw new GameError("You cannot play a card yet");
    }
    const current = this.order[this.turnIndex];
    if (current !== playerId) {
      throw new GameError("It is not your turn");
    }
    const hand = this.hands.get(playerId);
    if (!hand || !hand.includes(cardId)) {
      throw new GameError("That card is not in your hand");
    }
    const playable = this.playableCardIds(playerId);
    if (!playable.includes(cardId)) {
      throw new GameError("You must follow suit if able");
    }

    this.currentTrick.push({ playerId, cardId });
    this.hands.set(
      playerId,
      hand.filter((id) => id !== cardId),
    );

    if (this.currentTrick.length < this.order.length) {
      this.turnIndex = (this.turnIndex + 1) % this.order.length;
      return;
    }

    this.resolveTrick();
  }

  private resolveTrick(): void {
    const plays = this.currentTrick.map((play) => ({
      playerId: play.playerId,
      card: this.requireCard(play.cardId),
    }));
    const winnerIndex = trickWinnerIndex(plays);
    const winnerPlay = plays[winnerIndex];
    if (!winnerPlay) {
      throw new GameError("Could not resolve trick");
    }
    const publicPlays: CrewTrickPlay[] = plays.map((play) => ({
      playerId: play.playerId,
      card: publicCard(play.card),
    }));
    this.completedTricks.push({
      winnerId: winnerPlay.playerId,
      plays: publicPlays,
    });
    this.currentTrick = [];
    this.turnIndex = this.order.indexOf(winnerPlay.playerId);
    if (this.turnIndex < 0) {
      this.turnIndex = 0;
    }

    const handsEmpty = [...this.hands.values()].every((h) => h.length === 0);
    const evaluation = evaluateTasks(
      this.tasks,
      this.completedTricks,
      handsEmpty,
    );
    this.tasks = evaluation.tasks;
    if (evaluation.result === "success") {
      this.phase = "RESULTS";
      this.endReason = "success";
      return;
    }
    if (evaluation.result === "failure") {
      this.phase = "RESULTS";
      this.endReason = "failure";
    }
  }

  private communicate(
    playerId: string,
    cardId: string,
    signal: CrewSignal,
    attribute: CrewAttribute,
  ): void {
    if (this.phase !== "PLAYING") {
      throw new GameError("Communication is not available");
    }
    if (this.currentTrick.length > 0) {
      throw new GameError("Communication is only allowed before a trick begins");
    }
    if (this.communicatedPlayers.has(playerId)) {
      throw new GameError("You have already communicated this mission");
    }
    const hand = this.hands.get(playerId);
    if (!hand || !hand.includes(cardId)) {
      throw new GameError("That card is not in your hand");
    }
    const options = this.communicableOptions(playerId);
    const ok = options.some(
      (option) =>
        option.cardId === cardId &&
        option.signal === signal &&
        option.attribute === attribute,
    );
    if (!ok) {
      throw new GameError("That communication is not valid for your hand");
    }
    const card = this.requireCard(cardId);
    this.communications.push({
      playerId,
      cardId,
      signal,
      attribute,
      card: publicCard(card),
    });
    this.communicatedPlayers.add(playerId);
  }

  private legalActionsFor(playerId: string): CrewActionType[] {
    const actions: CrewActionType[] = [];
    if (this.phase === "TASKS") {
      actions.push("crew_begin_mission");
      return actions;
    }
    if (this.phase === "PLAYING") {
      if (this.order[this.turnIndex] === playerId) {
        actions.push("crew_play_card");
      }
      if (
        !this.communicatedPlayers.has(playerId) &&
        this.currentTrick.length === 0
      ) {
        actions.push("crew_communicate");
      }
    }
    return actions;
  }

  private playableCardIds(playerId: string): string[] {
    const hand = this.hands.get(playerId) ?? [];
    if (this.currentTrick.length === 0) {
      return [...hand];
    }
    const ledId = this.currentTrick[0]?.cardId;
    if (!ledId) {
      return [...hand];
    }
    const led = this.requireCard(ledId);
    const ledColor = led.color;
    const matching = hand.filter((id) => this.requireCard(id).color === ledColor);
    if (matching.length > 0) {
      return matching;
    }
    return [...hand];
  }

  private communicableOptions(playerId: string): CrewCommunicableOption[] {
    if (this.communicatedPlayers.has(playerId)) {
      return [];
    }
    const hand = this.hands.get(playerId) ?? [];
    const cards = hand.map((cardId) => this.requireCard(cardId));
    const options: CrewCommunicableOption[] = [];
    const signals: CrewSignal[] = ["highest", "lowest", "only"];
    const attributes: CrewAttribute[] = ["color", "rank"];
    for (const card of cards) {
      for (const signal of signals) {
        for (const attribute of attributes) {
          if (this.isValidCommunication(cards, card, signal, attribute)) {
            options.push({
              cardId: card.cardId,
              signal,
              attribute,
            });
          }
        }
      }
    }
    return options;
  }

  private isValidCommunication(
    hand: PhysicalCard[],
    card: PhysicalCard,
    signal: CrewSignal,
    attribute: CrewAttribute,
  ): boolean {
    if (card.color === "submarine") {
      return false;
    }
    if (attribute === "color") {
      const sameColor = hand.filter((c) => c.color === card.color);
      if (signal === "only") {
        return sameColor.length === 1;
      }
      const ranks = sameColor.map((c) => c.rank);
      if (signal === "highest") {
        return card.rank === Math.max(...ranks);
      }
      return card.rank === Math.min(...ranks);
    }
    const sameRank = hand.filter((c) => c.rank === card.rank);
    if (signal === "only") {
      return sameRank.length === 1;
    }
    // For attribute "rank", highest/lowest only apply when the card is the
    // sole card of that rank (same as "only" for multi-suit hands).
    return sameRank.length === 1;
  }

  private requireCard(cardId: string): PhysicalCard {
    const card = this.cards.get(cardId);
    if (!card) {
      throw new GameError("Unknown card");
    }
    return card;
  }
}
