export type RoomPhase = "LOBBY" | "GAME_RUNNING" | "GAME_OVER";

export type RoomVisibility = "public" | "private";

export type GameId =
  | "fakeArtist"
  | "telestrations"
  | "pictionary"
  | "hanabi"
  | "crew"
  | "wavelength"
  | "theGang";

export type FakeArtistSettings = { kind: "fakeArtist" };
export type TelestrationsSettings = { kind: "telestrations" };
export type PictionarySettings = { kind: "pictionary" };
export type HanabiSettings = { kind: "hanabi" };
export type CrewSettings = { kind: "crew" };
export type WavelengthSettings = { kind: "wavelength" };
export type TheGangSettings = { kind: "theGang" };
export type GameSettings =
  | FakeArtistSettings
  | TelestrationsSettings
  | PictionarySettings
  | HanabiSettings
  | CrewSettings
  | WavelengthSettings
  | TheGangSettings;

export type GameSetupField =
  | { key: string; type: "boolean"; label: string }
  | {
      key: string;
      type: "number";
      label: string;
      min: number;
      max: number;
    }
  | {
      key: string;
      type: "select";
      label: string;
      options: { value: string; label: string }[];
    };

export type GameSetupView = {
  gameId: GameId;
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  settings: GameSettings;
  fields: GameSetupField[];
};

export type RoomListItem = {
  roomCode: string;
  playerCount: number;
  maxPlayers: number;
  status: RoomPhase;
  visibility: "public";
  gameId: GameId | null;
  gameTitle: string | null;
  setup: GameSetupView | null;
  joinable: boolean;
};

export type PublicPlayer = {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  ready: boolean;
};

export type DummyPublicState = {
  kind: "dummy";
  label: string;
};

export type DummyPrivateState = {
  kind: "dummy";
  secret: string;
};

export type StrokePoint = { x: number; y: number };

export type Stroke = {
  playerId: string;
  points: StrokePoint[];
};

export type FakeArtistPhase =
  | "DRAWING"
  | "VOTING"
  | "GUESS"
  | "RESULTS"
  | "ABORTED";

export type FakeArtistWinner = "artists" | "fakeArtist" | "aborted";

export type FakeArtistVote = {
  voterId: string;
  targetPlayerId: string;
};

export type FakeArtistPublicState = {
  kind: "fakeArtist";
  phase: FakeArtistPhase;
  category: string;
  turnOrder: string[];
  currentPlayerId: string | null;
  round: number;
  strokes: Stroke[];
  votedPlayerIds: string[];
  /** Epoch ms when the current drawing turn ends; omitted when untimed. */
  endsAt?: number;
  fakeArtistId?: string;
  word?: string;
  votes?: FakeArtistVote[];
  winner?: FakeArtistWinner;
};

export type FakeArtistPrivateState = {
  kind: "fakeArtist";
  role: "artist" | "fakeArtist";
  category: string;
  legalActions: FakeArtistActionType[];
  word?: string;
};

export type TelestrationsPhase = "DRAWING" | "GUESSING" | "REVEAL" | "ABORTED";

export type TelestrationsActionType = "submit_drawing" | "submit_guess";

export type TelestrationsRevealedPage =
  | { kind: "prompt"; authorId: string; text: string }
  | { kind: "drawing"; authorId: string; strokes: Stroke[] }
  | { kind: "guess"; authorId: string; text: string };

export type TelestrationsBook = {
  ownerId: string;
  pages: TelestrationsRevealedPage[];
};

export type TelestrationsPublicState = {
  kind: "telestrations";
  phase: TelestrationsPhase;
  round: number;
  totalRounds: number;
  playerOrder: string[];
  submittedPlayerIds: string[];
  /** Epoch ms when the current draw/guess round ends; omitted when untimed. */
  endsAt?: number;
  books?: TelestrationsBook[];
};

export type TelestrationsPrivateState = {
  kind: "telestrations";
  phase: TelestrationsPhase;
  round: number;
  totalRounds: number;
  submitted: boolean;
  legalActions: TelestrationsActionType[];
  task: "draw" | "guess" | "reveal" | "wait";
  promptText?: string;
  guessText?: string;
  strokes?: Stroke[];
};

export type PictionaryPhase = "DRAWING" | "RESULTS" | "ABORTED";

export type PictionaryActionType = "submit_stroke" | "submit_guess";

export type PictionaryGuess = {
  playerId: string;
  text: string;
  correct: boolean;
};

export type PictionaryLastRound = {
  word: string;
  drawerId: string;
  solverId: string;
};

export type PictionaryRoundResult = {
  drawerId: string;
  word: string;
  solverId: string;
  strokes: Stroke[];
  guesses: PictionaryGuess[];
  /** True when the drawer’s turn ended because the round timer expired. */
  skipped?: boolean;
};

export type PictionaryPublicState = {
  kind: "pictionary";
  phase: PictionaryPhase;
  drawerId: string | null;
  round: number;
  totalRounds: number;
  strokes: Stroke[];
  guesses: PictionaryGuess[];
  solved: boolean;
  /** Epoch ms when the current drawing round ends; omitted when untimed. */
  endsAt?: number;
  lastRound?: PictionaryLastRound;
  history?: PictionaryRoundResult[];
};

export type PictionaryPrivateState = {
  kind: "pictionary";
  role: "drawer" | "guesser";
  legalActions: PictionaryActionType[];
  word?: string;
};

export type HanabiColor = "red" | "yellow" | "green" | "blue" | "white";
export type HanabiRank = 1 | 2 | 3 | 4 | 5;
export type HanabiPhase = "PLAYING" | "RESULTS" | "ABORTED";
export type HanabiEndReason = "fuses" | "perfect" | "deck" | "aborted";
export type HanabiActionType = "give_clue" | "play_card" | "discard_card";

export type HanabiClue =
  | { type: "color"; value: HanabiColor }
  | { type: "rank"; value: HanabiRank };

export type HanabiKnowledge = {
  notColors: HanabiColor[];
  notRanks: HanabiRank[];
  knownColor?: HanabiColor;
  knownRank?: HanabiRank;
};

export type HanabiCardView = {
  cardId: string;
  knowledge: HanabiKnowledge;
  color?: HanabiColor;
  rank?: HanabiRank;
};

export type HanabiPublicCard = {
  color: HanabiColor;
  rank: HanabiRank;
};

export type HanabiLogEntry =
  | {
      type: "clue";
      actorId: string;
      targetId: string;
      clue: HanabiClue;
    }
  | {
      type: "play";
      actorId: string;
      card: HanabiPublicCard;
      success: boolean;
    }
  | {
      type: "discard";
      actorId: string;
      card: HanabiPublicCard;
    };

export type HanabiPublicState = {
  kind: "hanabi";
  phase: HanabiPhase;
  currentPlayerId: string;
  order: string[];
  handSizes: Record<string, number>;
  stacks: Record<HanabiColor, number>;
  discard: HanabiPublicCard[];
  clueTokens: number;
  fuseTokens: number;
  deckCount: number;
  finalTurnsLeft: number | null;
  log: HanabiLogEntry[];
  endReason?: HanabiEndReason;
  score?: number;
};

export type HanabiPrivateState = {
  kind: "hanabi";
  hands: Record<string, HanabiCardView[]>;
  legalActions: HanabiActionType[];
};

export type CrewColor = "red" | "blue" | "green" | "yellow" | "submarine";
export type CrewRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type CrewPhase = "TASKS" | "PLAYING" | "RESULTS" | "ABORTED";
export type CrewEndReason = "success" | "failure" | "aborted";
export type CrewActionType =
  | "crew_begin_mission"
  | "crew_play_card"
  | "crew_communicate";
export type CrewSignal = "highest" | "lowest" | "only";
export type CrewAttribute = "color" | "rank";
export type CrewTaskStatus = "pending" | "satisfied" | "failed";

export type CrewPublicCard = {
  color: CrewColor;
  rank: CrewRank;
};

export type CrewCardView = {
  cardId: string;
  color: CrewColor;
  rank: CrewRank;
};

export type CrewTrickPlay = {
  playerId: string;
  card: CrewPublicCard;
};

export type CrewCompletedTrick = {
  winnerId: string;
  plays: CrewTrickPlay[];
};

export type CrewCommunicationMarker = {
  playerId: string;
  cardId: string;
  signal: CrewSignal;
  attribute: CrewAttribute;
  card: CrewPublicCard;
};

export type CrewTaskView = {
  id: string;
  description: string;
  status: CrewTaskStatus;
};

export type CrewMissionView = {
  id: string;
  title: string;
  description: string;
};

export type CrewPublicState = {
  kind: "crew";
  phase: CrewPhase;
  mission: CrewMissionView;
  tasks: CrewTaskView[];
  order: string[];
  currentPlayerId: string;
  trumpColor: "submarine";
  handSizes: Record<string, number>;
  currentTrick: CrewTrickPlay[];
  completedTricks: CrewCompletedTrick[];
  communications: CrewCommunicationMarker[];
  finalHands?: Record<string, CrewPublicCard[]>;
  endReason?: CrewEndReason;
};

export type CrewCommunicableOption = {
  cardId: string;
  signal: CrewSignal;
  attribute: CrewAttribute;
};

export type CrewPrivateState = {
  kind: "crew";
  hand: CrewCardView[];
  legalActions: CrewActionType[];
  playableCardIds?: string[];
  communicableOptions?: CrewCommunicableOption[];
};

export type WavelengthPhase = "CLUE" | "GUESSING" | "RESULTS" | "ABORTED";

export type WavelengthActionType = "submit_clue" | "submit_spectrum_guess";

export type WavelengthGuess = {
  playerId: string;
  position: number;
};

export type WavelengthRoundResult = {
  round: number;
  clueGiverId: string;
  leftLabel: string;
  rightLabel: string;
  target: number;
  clue: string;
  guesses: WavelengthGuess[];
  guessScores: Record<string, number>;
  roundScore: number;
};

export type WavelengthPublicState = {
  kind: "wavelength";
  phase: WavelengthPhase;
  round: number;
  totalRounds: number;
  clueGiverId: string;
  leftLabel: string;
  rightLabel: string;
  clue: string | null;
  submittedGuesserIds: string[];
  totalScore: number;
  lastReveal?: WavelengthRoundResult;
  history?: WavelengthRoundResult[];
};

export type WavelengthPrivateState = {
  kind: "wavelength";
  role: "clueGiver" | "guesser";
  legalActions: WavelengthActionType[];
  target?: number;
  myGuess?: number;
};

export type GangSuit = "clubs" | "diamonds" | "hearts" | "spades";

export type GangRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export type GangCard = {
  suit: GangSuit;
  rank: GangRank;
};

export type GangHandCategory =
  | "high_card"
  | "pair"
  | "two_pair"
  | "three_kind"
  | "straight"
  | "flush"
  | "full_house"
  | "four_kind"
  | "straight_flush";

export type GangHandView = {
  category: GangHandCategory;
  label: string;
  cards: GangCard[];
};

export type GangPhase =
  | "PREFLOP"
  | "FLOP"
  | "TURN"
  | "RIVER"
  | "SHOWDOWN"
  | "RESULTS"
  | "ABORTED";

export type GangChipColor = "white" | "yellow" | "orange" | "red";

export type GangChipSelection = {
  playerId: string;
  star: number;
};

export type GangChipSnapshot = {
  color: GangChipColor;
  held: GangChipSelection[];
};

export type GangHeistReveal = {
  playerId: string;
  star: number;
  hand: GangHandView;
};

export type GangHeistResult = {
  heistNumber: number;
  success: boolean;
  reveals: GangHeistReveal[];
  vaultsOpened: number;
  alarms: number;
};

export type GangPublicState = {
  kind: "theGang";
  phase: GangPhase;
  heistNumber: number;
  vaultsOpened: number;
  alarms: number;
  playerCount: number;
  communityCards: GangCard[];
  chipColor: GangChipColor;
  chipHeld: GangChipSelection[];
  chipCenter: number[];
  chipHistory: GangChipSnapshot[];
  lastHeist?: GangHeistResult;
  history?: GangHeistResult[];
  endReason?: "won" | "lost";
};

export type TheGangActionType =
  | "gang_take_center"
  | "gang_take_from_player"
  | "gang_return_chip";

export type GangPrivateState = {
  kind: "theGang";
  holeCards: GangCard[];
  legalActions: TheGangActionType[];
};

export type PublicGameState =
  | DummyPublicState
  | FakeArtistPublicState
  | TelestrationsPublicState
  | PictionaryPublicState
  | HanabiPublicState
  | CrewPublicState
  | WavelengthPublicState
  | GangPublicState;
export type PrivateGameState =
  | DummyPrivateState
  | FakeArtistPrivateState
  | TelestrationsPrivateState
  | PictionaryPrivateState
  | HanabiPrivateState
  | CrewPrivateState
  | WavelengthPrivateState
  | GangPrivateState;

export type FakeArtistActionType = "submit_stroke" | "vote" | "guess_word";

export type SubmitStrokeAction = {
  type: "submit_stroke";
  points: StrokePoint[];
};
export type VoteAction = { type: "vote"; targetPlayerId: string };
export type GuessWordAction = { type: "guess_word"; word: string };
export type SubmitDrawingAction = { type: "submit_drawing"; strokes: Stroke[] };
export type SubmitGuessAction = { type: "submit_guess"; text: string };
export type GiveClueAction = {
  type: "give_clue";
  targetPlayerId: string;
  clue: HanabiClue;
};
export type PlayCardAction = { type: "play_card"; cardId: string };
export type DiscardCardAction = { type: "discard_card"; cardId: string };
export type CrewBeginMissionAction = { type: "crew_begin_mission" };
export type CrewPlayCardAction = { type: "crew_play_card"; cardId: string };
export type CrewCommunicateAction = {
  type: "crew_communicate";
  cardId: string;
  signal: CrewSignal;
  attribute: CrewAttribute;
};
export type SubmitClueAction = { type: "submit_clue"; clue: string };
export type SubmitSpectrumGuessAction = {
  type: "submit_spectrum_guess";
  position: number;
};
export type GangTakeCenterAction = { type: "gang_take_center"; star: number };
export type GangTakeFromPlayerAction = {
  type: "gang_take_from_player";
  fromPlayerId: string;
};
export type GangReturnChipAction = { type: "gang_return_chip" };
export type GameAction =
  | SubmitStrokeAction
  | VoteAction
  | GuessWordAction
  | SubmitDrawingAction
  | SubmitGuessAction
  | GiveClueAction
  | PlayCardAction
  | DiscardCardAction
  | CrewBeginMissionAction
  | CrewPlayCardAction
  | CrewCommunicateAction
  | SubmitClueAction
  | SubmitSpectrumGuessAction
  | GangTakeCenterAction
  | GangTakeFromPlayerAction
  | GangReturnChipAction;

export type RoomStatePayload = {
  roomCode: string;
  phase: RoomPhase;
  hostPlayerId: string;
  players: PublicPlayer[];
  visibility: RoomVisibility;
  publicGame?: PublicGameState;
  setup?: GameSetupView;
};

export type CreateRoomMessage = {
  type: "create_room";
  name: string;
  visibility: RoomVisibility;
  password?: string;
};
export type JoinRoomMessage = {
  type: "join_room";
  roomCode: string;
  name: string;
  password?: string;
};
export type SetNameMessage = { type: "set_name"; name: string };
export type SelectGameMessage = { type: "select_game"; gameId: GameId };
export type UpdateGameSettingsMessage = {
  type: "update_game_settings";
  settings: GameSettings;
};
export type CancelGameSetupMessage = { type: "cancel_game_setup" };
export type SetReadyMessage = { type: "set_ready"; ready: boolean };
export type StartGameMessage = { type: "start_game" };
export type LeaveRoomMessage = { type: "leave_room" };
export type RemovePlayerMessage = { type: "remove_player"; playerId: string };
export type ReturnToLobbyMessage = { type: "return_to_lobby" };
export type PlayAgainMessage = { type: "play_again" };
export type GameActionMessage = { type: "game_action"; action: GameAction };
export type ReconnectMessage = { type: "reconnect"; reconnectToken: string };
export type PingMessage = { type: "ping" };
export type ListRoomsMessage = { type: "list_rooms" };

export type ClientMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | SetNameMessage
  | SelectGameMessage
  | UpdateGameSettingsMessage
  | CancelGameSetupMessage
  | SetReadyMessage
  | StartGameMessage
  | LeaveRoomMessage
  | RemovePlayerMessage
  | ReturnToLobbyMessage
  | PlayAgainMessage
  | GameActionMessage
  | ReconnectMessage
  | PingMessage
  | ListRoomsMessage;

export type WelcomeMessage = {
  type: "welcome";
  playerId: string;
  reconnectToken: string;
};
export type RoomCreatedMessage = {
  type: "room_created";
  roomCode: string;
  playerId: string;
  reconnectToken: string;
};
export type RoomStateMessage = { type: "room_state"; state: RoomStatePayload };
export type PrivateStateMessage = {
  type: "private_state";
  state: PrivateGameState;
};
export type GameStartedMessage = { type: "game_started" };
export type LeftRoomReason = "left" | "removed";
export type LeftRoomMessage = {
  type: "left_room";
  /** Why the client is no longer in the room. */
  reason: LeftRoomReason;
};
export type ErrorMessage = { type: "error"; message: string };
export type PongMessage = { type: "pong" };
export type RoomListMessage = { type: "room_list"; rooms: RoomListItem[] };

export type ServerMessage =
  | WelcomeMessage
  | RoomCreatedMessage
  | RoomStateMessage
  | PrivateStateMessage
  | GameStartedMessage
  | LeftRoomMessage
  | ErrorMessage
  | PongMessage
  | RoomListMessage;
