import type {
  GameAction,
  GangChipColor,
  GangChipSelection,
  GangChipSnapshot,
  GangHeistResult,
  GangPhase,
  GangPrivateState,
  GangPublicState,
  TheGangActionType,
} from "../../protocol/messages.ts";
import { GameError, type Game } from "../Game.ts";
import {
  cloneCards,
  createDeck,
  shuffleDeck,
  type GangCard,
} from "./cards.ts";
import {
  compareEvaluatedHands,
  handStrength,
  toHandView,
} from "./poker.ts";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 6;
const VAULTS_TO_WIN = 3;
const ALARMS_TO_LOSE = 3;

const CHIP_SEQUENCE: GangChipColor[] = ["white", "yellow", "orange", "red"];
const PHASE_SEQUENCE: GangPhase[] = ["PREFLOP", "FLOP", "TURN", "RIVER"];

type HoleCards = Record<string, GangCard[]>;

export class TheGangGame implements Game {
  private phase: GangPhase = "PREFLOP";
  private active = new Set<string>();
  private playerOrder: string[] = [];
  private deck: GangCard[] = [];
  private holeCards: HoleCards = {};
  private communityCards: GangCard[] = [];
  private chipColor: GangChipColor = "white";
  private chipHeld = new Map<string, number>();
  private chipHistory: GangChipSnapshot[] = [];
  private heistNumber = 1;
  private vaultsOpened = 0;
  private alarms = 0;
  private heistHistory: GangHeistResult[] = [];
  private lastHeist: GangHeistResult | null = null;
  private endReason: "won" | "lost" | null = null;

  canStart(playerCount: number): string | null {
    if (playerCount < MIN_PLAYERS) {
      return `The Gang needs at least ${MIN_PLAYERS} players`;
    }
    if (playerCount > MAX_PLAYERS) {
      return `The Gang supports at most ${MAX_PLAYERS} players`;
    }
    return null;
  }

  setup(playerIds: string[]): void {
    this.active = new Set(playerIds);
    this.playerOrder = [...playerIds];
    this.heistNumber = 1;
    this.vaultsOpened = 0;
    this.alarms = 0;
    this.heistHistory = [];
    this.lastHeist = null;
    this.endReason = null;
    this.phase = "PREFLOP";
    this.startHeist();
  }

  getPublicState(): GangPublicState {
    const state: GangPublicState = {
      kind: "theGang",
      phase: this.phase,
      heistNumber: this.heistNumber,
      vaultsOpened: this.vaultsOpened,
      alarms: this.alarms,
      playerCount: this.playerOrder.length,
      communityCards: cloneCards(this.communityCards),
      chipColor: this.chipColor,
      chipHeld: this.chipHeldEntries(),
      chipCenter: this.unclaimedStars(),
      chipHistory: this.chipHistory.map((snapshot) => ({
        color: snapshot.color,
        held: [...snapshot.held].sort((a, b) => a.star - b.star),
      })),
    };
    if (this.lastHeist) {
      state.lastHeist = this.cloneHeistResult(this.lastHeist);
    }
    if (this.heistHistory.length > 0) {
      state.history = this.heistHistory.map((heist) =>
        this.cloneHeistResult(heist),
      );
    }
    if (this.phase === "RESULTS" && this.endReason) {
      state.endReason = this.endReason;
    }
    return state;
  }

  getPrivateState(playerId: string): GangPrivateState {
    const hole = this.holeCards[playerId];
    return {
      kind: "theGang",
      holeCards: hole ? cloneCards(hole) : [],
      legalActions: this.legalActions(playerId),
    };
  }

  performAction(playerId: string, action: GameAction): void {
    if (!this.active.has(playerId)) {
      throw new GameError("You are not in this game");
    }
    if (this.isGameOver() || this.phase === "SHOWDOWN") {
      throw new GameError("The game is over");
    }
    if (!PHASE_SEQUENCE.includes(this.phase)) {
      throw new GameError("Strength actions are not available right now");
    }
    switch (action.type) {
      case "gang_claim_strength":
        this.claimStrength(playerId, action.star);
        return;
      case "gang_release_strength":
        this.releaseStrength(playerId);
        return;
      default:
        throw new GameError("That action is not valid in this game");
    }
  }

  onPlayerRemoved(playerId: string): void {
    if (this.isGameOver() || !this.active.has(playerId)) {
      return;
    }
    this.active.delete(playerId);
    delete this.holeCards[playerId];
    this.playerOrder = this.playerOrder.filter((id) => id !== playerId);
    this.chipHeld.delete(playerId);
    if (this.active.size < MIN_PLAYERS) {
      this.phase = "ABORTED";
      return;
    }
    this.rebuildStrengthClaims();
    if (this.allPlayersHoldChip()) {
      this.maybeAdvancePhase();
    }
  }

  isGameOver(): boolean {
    return this.phase === "RESULTS" || this.phase === "ABORTED";
  }

  getTimerDeadline(): number | null {
    return null;
  }

  onTimer(): void {
    // No timer in basic mode.
  }

  /** @internal Used by unit tests to advance after forced chip assignments. */
  advancePhaseForTests(): void {
    this.maybeAdvancePhase();
  }

  private startHeist(): void {
    this.deck = shuffleDeck(createDeck());
    this.communityCards = [];
    this.chipHistory = [];
    this.chipColor = "white";
    this.phase = "PREFLOP";
    this.holeCards = {};
    for (const playerId of this.playerOrder) {
      const first = this.deck.pop();
      const second = this.deck.pop();
      if (!first || !second) {
        throw new GameError("Deck exhausted");
      }
      this.holeCards[playerId] = [first, second];
    }
    this.resetChipPhase();
  }

  private resetChipPhase(): void {
    this.chipHeld.clear();
  }

  private starValues(): number[] {
    return Array.from({ length: this.playerOrder.length }, (_, index) => index + 1);
  }

  private unclaimedStars(): number[] {
    const held = new Set(this.chipHeld.values());
    return this.starValues().filter((star) => !held.has(star));
  }

  private isValidStar(star: number): boolean {
    return Number.isInteger(star) && star >= 1 && star <= this.playerOrder.length;
  }

  private holderOfStar(star: number): string | null {
    for (const [playerId, heldStar] of this.chipHeld.entries()) {
      if (heldStar === star) {
        return playerId;
      }
    }
    return null;
  }

  private claimStrength(playerId: string, star: number): void {
    if (this.chipHeld.has(playerId)) {
      throw new GameError("Release your strength claim before choosing another");
    }
    if (!this.isValidStar(star)) {
      throw new GameError("That strength position is not valid");
    }
    if (this.holderOfStar(star) !== null) {
      throw new GameError("That strength position is already claimed");
    }
    this.chipHeld.set(playerId, star);
    this.maybeAdvancePhase();
  }

  private releaseStrength(playerId: string): void {
    if (!this.chipHeld.has(playerId)) {
      throw new GameError("You have not claimed a strength position");
    }
    this.chipHeld.delete(playerId);
  }

  private maybeAdvancePhase(): void {
    if (!this.allPlayersHoldChip()) {
      return;
    }
    this.chipHistory.push({
      color: this.chipColor,
      held: this.chipHeldEntries(),
    });
    const phaseIndex = PHASE_SEQUENCE.indexOf(this.phase);
    if (phaseIndex < PHASE_SEQUENCE.length - 1) {
      const nextPhase = PHASE_SEQUENCE[phaseIndex + 1]!;
      this.phase = nextPhase;
      this.chipColor = CHIP_SEQUENCE[phaseIndex + 1]!;
      this.revealCommunityForPhase(nextPhase);
      this.resetChipPhase();
      return;
    }
    this.resolveShowdown();
  }

  private revealCommunityForPhase(phase: GangPhase): void {
    if (phase === "FLOP") {
      this.communityCards.push(this.draw(), this.draw(), this.draw());
      return;
    }
    if (phase === "TURN" || phase === "RIVER") {
      this.communityCards.push(this.draw());
    }
  }

  private draw(): GangCard {
    const card = this.deck.pop();
    if (!card) {
      throw new GameError("Deck exhausted");
    }
    return card;
  }

  private resolveShowdown(): void {
    this.phase = "SHOWDOWN";
    const redChips = this.chipHeldEntries().sort((a, b) => a.star - b.star);
    const reveals = redChips.map((entry) => {
      const hole = this.holeCards[entry.playerId] ?? [];
      const evaluated = handStrength(hole, this.communityCards);
      const view = toHandView(hole, this.communityCards);
      return {
        entry,
        evaluated,
        view,
      };
    });

    let success = true;
    for (let i = 1; i < reveals.length; i += 1) {
      if (compareEvaluatedHands(reveals[i]!.evaluated, reveals[i - 1]!.evaluated) < 0) {
        success = false;
        break;
      }
    }

    if (success) {
      this.vaultsOpened += 1;
    } else {
      this.alarms += 1;
    }

    const heistResult: GangHeistResult = {
      heistNumber: this.heistNumber,
      success,
      reveals: reveals.map(({ entry, view }) => ({
        playerId: entry.playerId,
        star: entry.star,
        hand: {
          category: view.category,
          label: view.label,
          cards: cloneCards(view.cards),
        },
      })),
      vaultsOpened: this.vaultsOpened,
      alarms: this.alarms,
    };
    this.heistHistory.push(heistResult);
    this.lastHeist = heistResult;

    if (this.vaultsOpened >= VAULTS_TO_WIN) {
      this.phase = "RESULTS";
      this.endReason = "won";
      return;
    }
    if (this.alarms >= ALARMS_TO_LOSE) {
      this.phase = "RESULTS";
      this.endReason = "lost";
      return;
    }

    this.heistNumber += 1;
    this.startHeist();
  }

  private allPlayersHoldChip(): boolean {
    return this.playerOrder.every((playerId) => this.chipHeld.has(playerId));
  }

  private chipHeldEntries(): GangChipSelection[] {
    return [...this.chipHeld.entries()]
      .map(([playerId, star]) => ({ playerId, star }))
      .sort((a, b) => a.star - b.star);
  }

  private rebuildStrengthClaims(): void {
    const maxStar = this.playerOrder.length;
    for (const [playerId, star] of [...this.chipHeld.entries()]) {
      if (star > maxStar) {
        this.chipHeld.delete(playerId);
      }
    }
  }

  private legalActions(playerId: string): TheGangActionType[] {
    if (!PHASE_SEQUENCE.includes(this.phase)) {
      return [];
    }
    if (this.chipHeld.has(playerId)) {
      return ["gang_release_strength"];
    }
    if (this.unclaimedStars().length > 0) {
      return ["gang_claim_strength"];
    }
    return [];
  }

  private cloneHeistResult(heist: GangHeistResult): GangHeistResult {
    return {
      ...heist,
      reveals: heist.reveals.map((reveal) => ({
        ...reveal,
        hand: {
          ...reveal.hand,
          cards: cloneCards(reveal.hand.cards),
        },
      })),
    };
  }
}
