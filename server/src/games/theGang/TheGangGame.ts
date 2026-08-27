import type {
  GameAction,
  GangCard,
  GangChipColor,
  GangChipSelection,
  GangChipSnapshot,
  GangHandCategory,
  GangHeistResult,
  GangMode,
  GangPhase,
  GangPrivateState,
  GangPublicState,
  GangRank,
  GangShowdownGate,
  GangSpecialistSetup,
  TheGangActionType,
} from "../../protocol/messages.ts";
import { GameError, type Game } from "../Game.ts";
import {
  cloneCards,
  createDeck,
  createJackSpecialistCard,
  shuffleDeck,
} from "./cards.ts";
import {
  categoryLabel,
  flopHasFaceCard,
  rankDisplay,
  shouldLockStar,
  specialistIsAutomatic,
  specialistNeedsAllPlayers,
  specialistNeedsAssignee,
} from "./modifierLogic.ts";
import {
  alarmsToLoseForMode,
  drawNextChallenge,
  drawNextSpecialist,
  lowestNumberedChallenge,
  masterThiefChallengeSlots,
  type GangActiveModifier,
  type GangChallengeId,
  type GangSpecialistId,
  toModifierView,
  usesModifierCards,
  usesSpecialistCards,
} from "./modifiers.ts";
import {
  compareForShowdown,
  countFaceCards,
  countRankInHole,
  handLabel,
  handStrength,
  mathWhizSum,
  pocketContainsRank,
  toHandView,
} from "./poker.ts";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 6;
const VAULTS_TO_WIN = 3;

const CHIP_SEQUENCE: GangChipColor[] = ["white", "yellow", "orange", "red"];
const PHASE_SEQUENCE: GangPhase[] = ["PREFLOP", "FLOP", "TURN", "RIVER"];

type HoleCards = Record<string, GangCard[]>;

type SetupState = GangSpecialistSetup & {
  mastermindRank?: GangRank;
  awaitingDiscard?: boolean;
};

export class TheGangGame implements Game {
  private readonly mode: GangMode;
  private readonly alarmsToLose: number;
  private phase: GangPhase = "PREFLOP";
  private active = new Set<string>();
  private playerOrder: string[] = [];
  private deck: GangCard[] = [];
  private holeCards: HoleCards = {};
  private communityCards: GangCard[] = [];
  private chipColor: GangChipColor = "white";
  private chipHeld = new Map<string, number>();
  private chipHistory: GangChipSnapshot[] = [];
  private lockedStars = new Set<number>();
  private heistNumber = 1;
  private vaultsOpened = 0;
  private alarms = 0;
  private heistHistory: GangHeistResult[] = [];
  private lastHeist: GangHeistResult | null = null;
  private endReason: "won" | "lost" | null = null;
  private activeModifiers: GangActiveModifier[] = [];
  private challengeDrawIndex = 0;
  private specialistDrawIndex = 0;
  private musclePlayerId: string | null = null;
  private getawayDriverAssigneeId: string | null = null;
  private getawayDriverDeclaration: { playerId: string; label: string } | null = null;
  private setupState: SetupState | null = null;
  private showdownGate: GangShowdownGate | null = null;
  private informantCards = new Map<string, GangCard>();
  private pendingCoordinatorPasses = new Map<string, GangCard>();

  constructor(mode: GangMode = "basic") {
    this.mode = mode;
    this.alarmsToLose = alarmsToLoseForMode(mode);
  }

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
    this.activeModifiers = [];
    this.challengeDrawIndex = 0;
    this.specialistDrawIndex = 0;
    this.musclePlayerId = null;
    this.getawayDriverAssigneeId = null;
    this.getawayDriverDeclaration = null;
    this.setupState = null;
    this.showdownGate = null;
    this.informantCards.clear();
    this.pendingCoordinatorPasses.clear();
    this.initModeModifiers();
    this.startHeist();
  }

  getPublicState(): GangPublicState {
    const state: GangPublicState = {
      kind: "theGang",
      mode: this.mode,
      alarmsToLose: this.alarmsToLose,
      activeModifiers: this.activeModifiers.map(toModifierView),
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
      lockedStars: [...this.lockedStars].sort((a, b) => a - b),
    };
    if (this.musclePlayerId) {
      state.musclePlayerId = this.musclePlayerId;
    }
    if (this.getawayDriverAssigneeId) {
      state.getawayDriverAssigneeId = this.getawayDriverAssigneeId;
    }
    if (this.getawayDriverDeclaration) {
      state.getawayDriverDeclaration = { ...this.getawayDriverDeclaration };
    }
    if (this.setupState) {
      state.specialistSetup = {
        specialistId: this.setupState.specialistId,
        assigneeId: this.setupState.assigneeId,
        pendingPlayerIds: [...this.setupState.pendingPlayerIds],
        declarations: [...this.setupState.declarations],
      };
    }
    if (this.showdownGate) {
      state.showdownGate = { ...this.showdownGate };
    }
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
    const privateState: GangPrivateState = {
      kind: "theGang",
      holeCards: hole ? cloneCards(hole) : [],
      legalActions: this.legalActions(playerId),
    };
    const informantCard = this.informantCards.get(playerId);
    if (informantCard) {
      privateState.informantCard = cloneCards([informantCard])[0]!;
    }
    return privateState;
  }

  performAction(playerId: string, action: GameAction): void {
    if (!this.active.has(playerId)) {
      throw new GameError("You are not in this game");
    }
    if (this.isGameOver()) {
      throw new GameError("The game is over");
    }
    if (this.phase === "MODIFIER_SETUP") {
      this.performSetupAction(playerId, action);
      return;
    }
    if (this.phase === "SHOWDOWN_GATE") {
      this.performShowdownGateAction(playerId, action);
      return;
    }
    if (this.phase === "SHOWDOWN") {
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
      case "gang_proceed_street":
        this.proceedStreet(playerId);
        return;
      case "gang_declare_category":
        this.declareGetawayCategory(playerId, action.category);
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
    this.informantCards.delete(playerId);
    if (this.musclePlayerId === playerId) {
      this.musclePlayerId = null;
    }
    if (this.getawayDriverAssigneeId === playerId) {
      this.getawayDriverAssigneeId = null;
    }
    if (this.setupState) {
      this.setupState.pendingPlayerIds = this.setupState.pendingPlayerIds.filter(
        (id) => id !== playerId,
      );
      if (this.setupState.assigneeId === playerId) {
        this.setupState.assigneeId = undefined;
        this.setupState.awaitingDiscard = false;
      }
      this.tryFinishSetup();
    }
    if (this.showdownGate) {
      this.showdownGate.submittedPlayerIds =
        this.showdownGate.submittedPlayerIds.filter((id) => id !== playerId);
      if (this.showdownGate.targetPlayerId === playerId) {
        this.showdownGate = null;
        this.resolveShowdown();
        return;
      }
      this.tryFinishShowdownGate();
    }
    if (this.active.size < MIN_PLAYERS) {
      this.phase = "ABORTED";
      return;
    }
    this.rebuildStrengthClaims();
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
    if (this.phase === "SHOWDOWN_GATE") {
      this.resolveShowdown();
      return;
    }
    this.maybeAdvancePhase();
  }

  /** @internal Used by unit tests to restart a heist with updated modifiers. */
  startHeistForTests(): void {
    this.startHeist();
  }

  private challengeIds(): Set<GangChallengeId> {
    return new Set(
      this.activeModifiers
        .filter((modifier) => modifier.kind === "challenge")
        .map((modifier) => modifier.id as GangChallengeId),
    );
  }

  private initModeModifiers(): void {
    if (this.mode === "professional") {
      this.addPermanentChallenge();
      return;
    }
    if (this.mode === "masterThief") {
      for (let slot = 0; slot < masterThiefChallengeSlots(); slot += 1) {
        this.addRotatingChallenge();
      }
    }
  }

  private addPermanentChallenge(): void {
    const drawn = drawNextChallenge(this.mode, this.challengeDrawIndex);
    this.challengeDrawIndex = drawn.nextIndex;
    this.activeModifiers.push({
      kind: "challenge",
      id: drawn.id,
      permanent: true,
    });
  }

  private addRotatingChallenge(): void {
    const drawn = drawNextChallenge(this.mode, this.challengeDrawIndex);
    this.challengeDrawIndex = drawn.nextIndex;
    this.activeModifiers.push({
      kind: "challenge",
      id: drawn.id,
    });
  }

  private rotateMasterThiefChallenges(): void {
    const lowest = lowestNumberedChallenge(this.activeModifiers);
    if (!lowest) {
      return;
    }
    this.activeModifiers = this.activeModifiers.filter(
      (modifier) => modifier !== lowest,
    );
    this.addRotatingChallenge();
  }

  private clearRotatingModifiers(): void {
    this.activeModifiers = this.activeModifiers.filter(
      (modifier) => modifier.permanent,
    );
  }

  private activateModifierForNextHeist(success: boolean): void {
    if (!usesModifierCards(this.mode)) {
      return;
    }
    if (this.mode === "masterThief") {
      return;
    }
    this.clearRotatingModifiers();
    if (success) {
      this.addRotatingChallenge();
      return;
    }
    if (!usesSpecialistCards(this.mode)) {
      return;
    }
    const drawn = drawNextSpecialist(this.mode, this.specialistDrawIndex);
    this.specialistDrawIndex = drawn.nextIndex;
    this.activeModifiers.push({ kind: "specialist", id: drawn.id });
  }

  private hasActiveChallenge(id: GangChallengeId): boolean {
    return this.challengeIds().has(id);
  }

  private getRotatingSpecialist(): GangSpecialistId | null {
    const specialist = this.activeModifiers.find(
      (modifier) => modifier.kind === "specialist" && !modifier.permanent,
    );
    return (specialist?.id as GangSpecialistId | undefined) ?? null;
  }

  private startHeist(): void {
    if (this.mode === "masterThief" && this.heistNumber > 1) {
      this.rotateMasterThiefChallenges();
    }
    this.deck = shuffleDeck(createDeck());
    this.communityCards = [];
    this.chipHistory = [];
    this.lockedStars.clear();
    this.chipColor = "white";
    this.chipHeld.clear();
    this.musclePlayerId = null;
    this.getawayDriverAssigneeId = null;
    this.getawayDriverDeclaration = null;
    this.setupState = null;
    this.showdownGate = null;
    this.informantCards.clear();
    this.pendingCoordinatorPasses.clear();
    this.holeCards = {};
    const holeCount = this.hasActiveChallenge("securityCameras") ? 3 : 2;
    for (const playerId of this.playerOrder) {
      const cards: GangCard[] = [];
      for (let i = 0; i < holeCount; i += 1) {
        cards.push(this.draw());
      }
      this.holeCards[playerId] = cards;
    }
    this.applyConwomanIfActive();
    const specialist = this.getRotatingSpecialist();
    if (specialist && !specialistIsAutomatic(specialist)) {
      this.beginSpecialistSetup(specialist);
      return;
    }
    this.beginChipPhaseAfterDeal();
  }

  private applyConwomanIfActive(): void {
    const specialist = this.getRotatingSpecialist();
    if (specialist !== "conwoman") {
      return;
    }
    const pool = this.playerOrder.flatMap(
      (playerId) => this.holeCards[playerId] ?? [],
    );
    const shuffled = shuffleDeck(pool);
    let index = 0;
    for (const playerId of this.playerOrder) {
      const count = this.holeCards[playerId]?.length ?? 0;
      this.holeCards[playerId] = shuffled.slice(index, index + count);
      index += count;
    }
  }

  private beginSpecialistSetup(specialistId: GangSpecialistId): void {
    this.phase = "MODIFIER_SETUP";
    this.setupState = {
      specialistId,
      pendingPlayerIds: specialistNeedsAllPlayers(specialistId)
        ? [...this.playerOrder]
        : [],
      declarations: [],
    };
  }

  private beginChipPhaseAfterDeal(): void {
    if (this.hasActiveChallenge("quickAccess")) {
      this.communityCards.push(this.draw(), this.draw(), this.draw());
      this.phase = "FLOP";
      this.chipColor = "yellow";
      this.applyPostFlopChallenges();
      return;
    }
    this.phase = "PREFLOP";
    this.chipColor = "white";
  }

  private performSetupAction(playerId: string, action: GameAction): void {
    if (!this.setupState) {
      throw new GameError("No specialist setup is active");
    }
    switch (action.type) {
      case "gang_take_specialist":
        this.takeSpecialist(playerId);
        return;
      case "gang_informant":
        this.informantShare(playerId, action.targetPlayerId, action.cardIndex);
        return;
      case "gang_discard_hole":
        this.discardHole(playerId, action.cardIndex);
        return;
      case "gang_coordinator_pass":
        this.coordinatorPass(playerId, action.cardIndex);
        return;
      case "gang_declare_face_cards":
        this.declareFaceCards(playerId, action.count);
        return;
      case "gang_declare_math_sum":
        this.declareMathSum(playerId, action.sum);
        return;
      case "gang_declare_rank_count":
        this.declareRankCount(playerId, action.rank, action.count);
        return;
      default:
        throw new GameError("That action is not valid right now");
    }
  }

  private takeSpecialist(playerId: string): void {
    const setup = this.requireSetup();
    const specialistId = setup.specialistId as GangSpecialistId;
    if (!specialistNeedsAssignee(specialistId)) {
      throw new GameError("This specialist does not need an assignee");
    }
    if (setup.assigneeId) {
      throw new GameError("Someone already took this specialist");
    }
    setup.assigneeId = playerId;
    if (specialistId === "muscle") {
      this.musclePlayerId = playerId;
      this.finishSetup();
      return;
    }
    if (specialistId === "getawayDriver") {
      this.getawayDriverAssigneeId = playerId;
      this.finishSetup();
      return;
    }
    if (specialistId === "hacker") {
      this.holeCards[playerId]!.push(this.draw());
      setup.awaitingDiscard = true;
      return;
    }
    if (specialistId === "jack") {
      this.holeCards[playerId]!.push(createJackSpecialistCard());
      setup.awaitingDiscard = true;
      return;
    }
    if (specialistId === "mastermind") {
      setup.mastermindRank = undefined;
    }
  }

  private informantShare(
    playerId: string,
    targetPlayerId: string,
    cardIndex: number,
  ): void {
    const setup = this.requireSetup();
    if (setup.specialistId !== "informant" || setup.assigneeId !== playerId) {
      throw new GameError("You cannot use the Informant right now");
    }
    if (!this.active.has(targetPlayerId) || targetPlayerId === playerId) {
      throw new GameError("Invalid Informant target");
    }
    const card = this.pickHoleCard(playerId, cardIndex);
    this.informantCards.set(targetPlayerId, card);
    this.finishSetup();
  }

  private discardHole(playerId: string, cardIndex: number): void {
    const setup = this.requireSetup();
    if (setup.assigneeId !== playerId || !setup.awaitingDiscard) {
      throw new GameError("You cannot discard right now");
    }
    const hole = this.holeCards[playerId];
    if (!hole || cardIndex < 0 || cardIndex >= hole.length) {
      throw new GameError("Invalid card selection");
    }
    hole.splice(cardIndex, 1);
    setup.awaitingDiscard = false;
    this.finishSetup();
  }

  private coordinatorPass(playerId: string, cardIndex: number): void {
    const setup = this.requireSetup();
    if (setup.specialistId !== "coordinator") {
      throw new GameError("Coordinator is not active");
    }
    if (!setup.pendingPlayerIds.includes(playerId)) {
      throw new GameError("You already passed a card");
    }
    const card = this.pickHoleCard(playerId, cardIndex);
    setup.pendingPlayerIds = setup.pendingPlayerIds.filter((id) => id !== playerId);
    setup.declarations.push({
      playerId,
      label: `Passed ${card.rank}`,
    });
    this.pendingCoordinatorPasses.set(playerId, card);
    if (setup.pendingPlayerIds.length === 0) {
      this.applyCoordinatorPasses();
      this.finishSetup();
    }
  }

  private applyCoordinatorPasses(): void {
    for (const playerId of this.playerOrder) {
      const card = this.pendingCoordinatorPasses.get(playerId);
      if (!card) {
        continue;
      }
      const leftId = this.leftNeighbor(playerId);
      this.holeCards[leftId]!.push(card);
    }
    this.pendingCoordinatorPasses.clear();
  }

  private declareFaceCards(playerId: string, count: number): void {
    const setup = this.requireSetup();
    if (setup.specialistId !== "investor") {
      throw new GameError("Investor is not active");
    }
    const actual = countFaceCards(this.holeCards[playerId] ?? []);
    if (count !== actual) {
      throw new GameError("That face-card count does not match your hand");
    }
    this.recordSetupDeclaration(playerId, `${count} face card${count === 1 ? "" : "s"}`);
  }

  private declareMathSum(playerId: string, sum: number): void {
    const setup = this.requireSetup();
    if (setup.specialistId !== "mathWhiz") {
      throw new GameError("Math Whiz is not active");
    }
    const actual = mathWhizSum(this.holeCards[playerId] ?? []);
    if (sum !== actual) {
      throw new GameError("That sum does not match your hand");
    }
    this.recordSetupDeclaration(playerId, `Sum ${sum}`);
  }

  private declareGetawayCategory(playerId: string, category: GangHandCategory): void {
    if (this.getawayDriverAssigneeId !== playerId) {
      throw new GameError("You cannot declare a category right now");
    }
    if (!this.canEvaluateHand(playerId)) {
      throw new GameError("Not enough cards to evaluate your hand yet");
    }
    const evaluated = handStrength(
      this.holeCards[playerId] ?? [],
      this.communityCards,
    );
    if (evaluated.category !== category) {
      throw new GameError("That category does not match your current hand");
    }
    this.getawayDriverDeclaration = {
      playerId,
      label: categoryLabel(category),
    };
    this.getawayDriverAssigneeId = null;
  }

  private canEvaluateHand(playerId: string): boolean {
    const holeCount = this.holeCards[playerId]?.length ?? 0;
    return holeCount + this.communityCards.length >= 5;
  }

  private declareRankCount(playerId: string, rank: GangRank, count: number): void {
    const setup = this.requireSetup();
    if (setup.specialistId !== "mastermind" || setup.assigneeId !== playerId) {
      throw new GameError("You cannot declare a rank count right now");
    }
    const chosenRank = setup.mastermindRank ?? rank;
    setup.mastermindRank = chosenRank;
    const actual = countRankInHole(this.holeCards[playerId] ?? [], chosenRank);
    if (count !== actual) {
      throw new GameError("That rank count does not match your hand");
    }
    setup.declarations.push({
      playerId,
      label: `${count} × ${rankDisplay(chosenRank)}`,
    });
    this.finishSetup();
  }

  private recordSetupDeclaration(playerId: string, label: string): void {
    const setup = this.requireSetup();
    if (!setup.pendingPlayerIds.includes(playerId)) {
      throw new GameError("You already declared");
    }
    setup.pendingPlayerIds = setup.pendingPlayerIds.filter((id) => id !== playerId);
    setup.declarations.push({ playerId, label });
    if (setup.pendingPlayerIds.length === 0) {
      this.finishSetup();
    }
  }

  private tryFinishSetup(): void {
    if (!this.setupState) {
      return;
    }
    if (
      this.setupState.pendingPlayerIds.length === 0 &&
      !this.setupState.awaitingDiscard
    ) {
      this.finishSetup();
    }
  }

  private finishSetup(): void {
    this.setupState = null;
    this.beginChipPhaseAfterDeal();
  }

  private requireSetup(): SetupState {
    if (!this.setupState) {
      throw new GameError("No specialist setup is active");
    }
    return this.setupState;
  }

  private leftNeighbor(playerId: string): string {
    const index = this.playerOrder.indexOf(playerId);
    return this.playerOrder[(index + 1) % this.playerOrder.length]!;
  }

  private pickHoleCard(playerId: string, cardIndex: number): GangCard {
    const hole = this.holeCards[playerId];
    if (!hole || cardIndex < 0 || cardIndex >= hole.length) {
      throw new GameError("Invalid card selection");
    }
    const [card] = hole.splice(cardIndex, 1);
    if (!card) {
      throw new GameError("Invalid card selection");
    }
    return card;
  }

  private performShowdownGateAction(playerId: string, action: GameAction): void {
    if (!this.showdownGate) {
      throw new GameError("No showdown gate is active");
    }
    if (playerId === this.showdownGate.targetPlayerId) {
      throw new GameError("The target player cannot submit a guess");
    }
    if (this.showdownGate.submittedPlayerIds.includes(playerId)) {
      throw new GameError("You already submitted a guess");
    }
    if (this.showdownGate.kind === "retinaScan") {
      if (action.type !== "gang_guess_pocket_rank") {
        throw new GameError("Submit a pocket rank guess");
      }
      if (this.showdownGate.agreedRank && this.showdownGate.agreedRank !== action.rank) {
        throw new GameError("Your guess must match the group's agreed rank");
      }
      this.showdownGate.agreedRank = action.rank;
    } else if (action.type !== "gang_guess_hand_category") {
      throw new GameError("Submit a hand category guess");
    } else {
      if (
        this.showdownGate.agreedCategory &&
        this.showdownGate.agreedCategory !== action.category
      ) {
        throw new GameError("Your guess must match the group's agreed category");
      }
      this.showdownGate.agreedCategory = action.category;
    }
    this.showdownGate.submittedPlayerIds.push(playerId);
    this.tryFinishShowdownGate();
  }

  private tryFinishShowdownGate(): void {
    if (!this.showdownGate) {
      return;
    }
    const guessers = this.playerOrder.filter(
      (id) => id !== this.showdownGate!.targetPlayerId,
    );
    if (this.showdownGate.submittedPlayerIds.length < guessers.length) {
      return;
    }
    this.resolveShowdown();
  }

  private resetChipPhase(): void {
    this.chipHeld.clear();
    this.lockedStars.clear();
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
    if (!this.isValidStar(star)) {
      throw new GameError("That strength position is not valid");
    }
    const currentStar = this.chipHeld.get(playerId);
    if (currentStar === star) {
      if (this.lockedStars.has(star)) {
        throw new GameError("That strength position is locked");
      }
      this.chipHeld.delete(playerId);
      return;
    }
    const holder = this.holderOfStar(star);
    if (holder !== null) {
      if (this.lockedStars.has(star)) {
        throw new GameError("That strength position is locked");
      }
      this.chipHeld.delete(holder);
      this.chipHeld.set(playerId, star);
      return;
    }
    if (currentStar !== undefined && this.lockedStars.has(currentStar)) {
      throw new GameError("Your current strength position is locked");
    }
    this.chipHeld.set(playerId, star);
    if (shouldLockStar(this.challengeIds(), this.chipColor, star, this.playerOrder.length)) {
      this.lockedStars.add(star);
    }
  }

  private proceedStreet(_playerId: string): void {
    if (!this.allPlayersHoldChip()) {
      throw new GameError("Not everyone has claimed a strength position yet");
    }
    this.maybeAdvancePhase();
  }

  private releaseStrength(playerId: string): void {
    const star = this.chipHeld.get(playerId);
    if (star === undefined) {
      throw new GameError("You have not claimed a strength position");
    }
    if (this.lockedStars.has(star)) {
      throw new GameError("Your strength position is locked");
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
      let nextPhase = PHASE_SEQUENCE[phaseIndex + 1]!;
      let nextChipColor = CHIP_SEQUENCE[phaseIndex + 1]!;
      if (nextPhase === "TURN" && this.hasActiveChallenge("hastyGetaway")) {
        nextPhase = "RIVER";
        nextChipColor = "red";
      }
      if (this.hasActiveChallenge("blackout")) {
        this.chipHistory = [];
      }
      this.phase = nextPhase;
      this.chipColor = nextChipColor;
      this.revealCommunityForPhase(nextPhase, phaseIndex + 1);
      if (nextPhase === "FLOP") {
        this.applyPostFlopChallenges();
      }
      this.resetChipPhase();
      return;
    }
    if (this.needsShowdownGate()) {
      this.beginShowdownGate();
      return;
    }
    this.resolveShowdown();
  }

  private revealCommunityForPhase(phase: GangPhase, phaseIndex: number): void {
    if (phase === "FLOP") {
      this.communityCards.push(this.draw(), this.draw(), this.draw());
      return;
    }
    if (phase === "TURN") {
      this.communityCards.push(this.draw());
      return;
    }
    if (phase === "RIVER") {
      const skippedTurn =
        phaseIndex === PHASE_SEQUENCE.indexOf("RIVER") &&
        this.hasActiveChallenge("hastyGetaway");
      if (skippedTurn && this.communityCards.length === 3) {
        this.communityCards.push(this.draw());
        return;
      }
      this.communityCards.push(this.draw());
    }
  }

  private applyPostFlopChallenges(): void {
    if (this.communityCards.length < 3) {
      return;
    }
    const hasFace = flopHasFaceCard(this.communityCards);
    if (this.hasActiveChallenge("motionDetector") && hasFace) {
      const holder = this.holderFromHistory("white", 1);
      if (holder) {
        this.redrawHoleCards(holder);
      }
    }
    if (this.hasActiveChallenge("laserTripwires") && !hasFace) {
      const holder = this.holderFromHistory("white", this.playerOrder.length);
      if (holder) {
        this.redrawHoleCards(holder);
      }
    }
  }

  private holderFromHistory(color: GangChipColor, star: number): string | null {
    const snapshot = this.chipHistory.find((entry) => entry.color === color);
    return snapshot?.held.find((entry) => entry.star === star)?.playerId ?? null;
  }

  private redrawHoleCards(playerId: string): void {
    const count = this.holeCards[playerId]?.length ?? 2;
    const cards: GangCard[] = [];
    for (let i = 0; i < count; i += 1) {
      cards.push(this.draw());
    }
    this.holeCards[playerId] = cards;
  }

  private needsShowdownGate(): boolean {
    return (
      this.hasActiveChallenge("retinaScan") ||
      this.hasActiveChallenge("fingerprintScan")
    );
  }

  private beginShowdownGate(): void {
    const redChips = this.chipHeldEntries().sort((a, b) => b.star - a.star);
    const targetPlayerId = redChips[0]?.playerId;
    if (!targetPlayerId) {
      this.resolveShowdown();
      return;
    }
    this.phase = "SHOWDOWN_GATE";
    this.showdownGate = {
      kind: this.hasActiveChallenge("retinaScan") ? "retinaScan" : "fingerprintScan",
      targetPlayerId,
      submittedPlayerIds: [],
    };
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
    let gateFailed = false;
    if (this.showdownGate) {
      gateFailed = this.evaluateShowdownGate();
      this.showdownGate = null;
    }
    const redChips = this.chipHeldEntries().sort((a, b) => a.star - b.star);
    const reveals = redChips.map((entry) => {
      const hole = this.holeCards[entry.playerId] ?? [];
      const evaluated = handStrength(hole, this.communityCards);
      const view = toHandView(hole, this.communityCards);
      return { entry, evaluated, view };
    });

    let success = !gateFailed;
    if (success) {
      for (let i = 1; i < reveals.length; i += 1) {
        const cmp = compareForShowdown(
          reveals[i]!.evaluated,
          reveals[i - 1]!.evaluated,
          reveals[i]!.entry.playerId,
          reveals[i - 1]!.entry.playerId,
          this.musclePlayerId,
        );
        if (cmp < 0) {
          success = false;
          break;
        }
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
    if (this.alarms >= this.alarmsToLose) {
      this.phase = "RESULTS";
      this.endReason = "lost";
      return;
    }

    this.activateModifierForNextHeist(success);
    this.heistNumber += 1;
    this.startHeist();
  }

  private evaluateShowdownGate(): boolean {
    if (!this.showdownGate) {
      return false;
    }
    const hole = this.holeCards[this.showdownGate.targetPlayerId] ?? [];
    if (this.showdownGate.kind === "retinaScan") {
      const rank = this.showdownGate.agreedRank;
      if (rank === undefined) {
        return true;
      }
      return !pocketContainsRank(hole, rank);
    }
    const category = this.showdownGate.agreedCategory;
    if (category === undefined) {
      return true;
    }
    const evaluated = handStrength(hole, this.communityCards);
    return evaluated.category !== category;
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
    for (const star of [...this.lockedStars]) {
      if (star > maxStar) {
        this.lockedStars.delete(star);
      }
    }
  }

  private legalActions(playerId: string): TheGangActionType[] {
    if (this.phase === "MODIFIER_SETUP") {
      return this.legalSetupActions(playerId);
    }
    if (this.phase === "SHOWDOWN_GATE") {
      return this.legalShowdownGateActions(playerId);
    }
    if (!PHASE_SEQUENCE.includes(this.phase)) {
      return [];
    }
    const actions: TheGangActionType[] = [];
    const heldStar = this.chipHeld.get(playerId);
    if (heldStar !== undefined && !this.lockedStars.has(heldStar)) {
      actions.push("gang_release_strength");
    }
    actions.push("gang_claim_strength");
    if (this.allPlayersHoldChip()) {
      actions.push("gang_proceed_street");
    }
    if (
      this.getawayDriverAssigneeId === playerId &&
      this.canEvaluateHand(playerId)
    ) {
      actions.push("gang_declare_category");
    }
    return actions;
  }

  private legalSetupActions(playerId: string): TheGangActionType[] {
    const setup = this.setupState;
    if (!setup) {
      return [];
    }
    const specialistId = setup.specialistId as GangSpecialistId;
    const actions: TheGangActionType[] = [];
    if (specialistNeedsAssignee(specialistId) && !setup.assigneeId) {
      actions.push("gang_take_specialist");
    }
    if (setup.assigneeId === playerId && setup.awaitingDiscard) {
      actions.push("gang_discard_hole");
    }
    if (specialistId === "informant" && setup.assigneeId === playerId) {
      actions.push("gang_informant");
    }
    if (specialistId === "mastermind" && setup.assigneeId === playerId) {
      actions.push("gang_declare_rank_count");
    }
    if (specialistId === "investor" && setup.pendingPlayerIds.includes(playerId)) {
      actions.push("gang_declare_face_cards");
    }
    if (specialistId === "mathWhiz" && setup.pendingPlayerIds.includes(playerId)) {
      actions.push("gang_declare_math_sum");
    }
    if (specialistId === "coordinator" && setup.pendingPlayerIds.includes(playerId)) {
      actions.push("gang_coordinator_pass");
    }
    return actions;
  }

  private legalShowdownGateActions(playerId: string): TheGangActionType[] {
    if (!this.showdownGate || playerId === this.showdownGate.targetPlayerId) {
      return [];
    }
    if (this.showdownGate.submittedPlayerIds.includes(playerId)) {
      return [];
    }
    if (this.showdownGate.kind === "retinaScan") {
      return ["gang_guess_pocket_rank"];
    }
    return ["gang_guess_hand_category"];
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
