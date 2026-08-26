export type RoomPhase = "LOBBY" | "GAME_RUNNING" | "GAME_OVER";

export type RoomVisibility = "public" | "private";

export type PublicPlayer = {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  ready: boolean;
};

export type GameId =
  | "fakeArtist"
  | "telestrations"
  | "pictionary"
  | "hanabi"
  | "crew";

export type FakeArtistSettings = { kind: "fakeArtist" };
export type TelestrationsSettings = { kind: "telestrations" };
export type PictionarySettings = { kind: "pictionary" };
export type HanabiSettings = { kind: "hanabi" };
export type CrewSettings = { kind: "crew" };
export type GameSettings =
  | FakeArtistSettings
  | TelestrationsSettings
  | PictionarySettings
  | HanabiSettings
  | CrewSettings;

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

export type PublicGameState =
  | DummyPublicState
  | FakeArtistPublicState
  | TelestrationsPublicState
  | PictionaryPublicState
  | HanabiPublicState
  | CrewPublicState;
export type PrivateGameState =
  | DummyPrivateState
  | FakeArtistPrivateState
  | TelestrationsPrivateState
  | PictionaryPrivateState
  | HanabiPrivateState
  | CrewPrivateState;

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
  | CrewCommunicateAction;

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

export type ParseResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; error: string };

function asRecord(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  return data as Record<string, unknown>;
}

function parseName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const name = value.trim();
  if (name.length === 0 || name.length > 32) {
    return null;
  }
  return name;
}

function parseVisibility(value: unknown): RoomVisibility | null {
  if (value === undefined) {
    return "public";
  }
  if (value === "public" || value === "private") {
    return value;
  }
  return null;
}

function parsePassword(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  if (value.length === 0 || value.length > 64) {
    return null;
  }
  return value;
}

function parseRoomCode(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(code)) {
    return null;
  }
  return code;
}

export function parseClientMessage(data: unknown): ParseResult {
  const msg = asRecord(data);
  if (!msg) {
    return { ok: false, error: "Message must be a JSON object" };
  }
  if (typeof msg.type !== "string") {
    return { ok: false, error: "Missing message type" };
  }

  switch (msg.type) {
    case "create_room": {
      const name = parseName(msg.name);
      if (!name) {
        return { ok: false, error: "Name is required (1–32 characters)" };
      }
      const visibility = parseVisibility(msg.visibility);
      if (!visibility) {
        return { ok: false, error: "Invalid room visibility" };
      }
      if (visibility === "private") {
        const password = parsePassword(msg.password);
        if (!password) {
          return { ok: false, error: "Private rooms require a password" };
        }
        return {
          ok: true,
          message: { type: "create_room", name, visibility, password },
        };
      }
      return { ok: true, message: { type: "create_room", name, visibility } };
    }
    case "join_room": {
      const name = parseName(msg.name);
      const roomCode = parseRoomCode(msg.roomCode);
      if (!name) {
        return { ok: false, error: "Name is required (1–32 characters)" };
      }
      if (!roomCode) {
        return { ok: false, error: "Room code must be 4 letters or digits" };
      }
      if (msg.password === undefined) {
        return { ok: true, message: { type: "join_room", roomCode, name } };
      }
      if (typeof msg.password !== "string") {
        return { ok: false, error: "Invalid password" };
      }
      if (msg.password.length === 0 || msg.password.length > 64) {
        return { ok: false, error: "Invalid password" };
      }
      return {
        ok: true,
        message: {
          type: "join_room",
          roomCode,
          name,
          password: msg.password,
        },
      };
    }
    case "set_name": {
      const name = parseName(msg.name);
      if (!name) {
        return { ok: false, error: "Name is required (1–32 characters)" };
      }
      return { ok: true, message: { type: "set_name", name } };
    }
    case "select_game": {
      if (!isGameId(msg.gameId)) {
        return { ok: false, error: "Unknown game" };
      }
      return { ok: true, message: { type: "select_game", gameId: msg.gameId } };
    }
    case "update_game_settings": {
      const settings = parseGameSettings(msg.settings);
      if (!settings) {
        return { ok: false, error: "Invalid game settings" };
      }
      return {
        ok: true,
        message: { type: "update_game_settings", settings },
      };
    }
    case "cancel_game_setup":
      return { ok: true, message: { type: "cancel_game_setup" } };
    case "set_ready": {
      if (typeof msg.ready !== "boolean") {
        return { ok: false, error: "Invalid ready value" };
      }
      return { ok: true, message: { type: "set_ready", ready: msg.ready } };
    }
    case "start_game":
      return { ok: true, message: { type: "start_game" } };
    case "leave_room":
      return { ok: true, message: { type: "leave_room" } };
    case "remove_player": {
      if (typeof msg.playerId !== "string" || msg.playerId.length === 0) {
        return { ok: false, error: "Player id is required" };
      }
      return {
        ok: true,
        message: { type: "remove_player", playerId: msg.playerId },
      };
    }
    case "return_to_lobby":
      return { ok: true, message: { type: "return_to_lobby" } };
    case "play_again":
      return { ok: true, message: { type: "play_again" } };
    case "game_action": {
      const action = parseGameAction(msg.action);
      if (!action) {
        return { ok: false, error: "Invalid game action" };
      }
      return { ok: true, message: { type: "game_action", action } };
    }
    case "reconnect": {
      if (typeof msg.reconnectToken !== "string" || msg.reconnectToken.length === 0) {
        return { ok: false, error: "Reconnect token is required" };
      }
      return {
        ok: true,
        message: { type: "reconnect", reconnectToken: msg.reconnectToken },
      };
    }
    case "ping":
      return { ok: true, message: { type: "ping" } };
    case "list_rooms":
      return { ok: true, message: { type: "list_rooms" } };
    default:
      return { ok: false, error: `Unknown message type: ${msg.type}` };
  }
}

function parseGameAction(value: unknown): GameAction | null {
  const action = asRecord(value);
  if (!action || typeof action.type !== "string") {
    return null;
  }
  switch (action.type) {
    case "submit_stroke": {
      const points = parseStrokePoints(action.points);
      if (!points) {
        return null;
      }
      return { type: "submit_stroke", points };
    }
    case "vote": {
      if (typeof action.targetPlayerId !== "string" || action.targetPlayerId.length === 0) {
        return null;
      }
      return { type: "vote", targetPlayerId: action.targetPlayerId };
    }
    case "guess_word": {
      if (typeof action.word !== "string") {
        return null;
      }
      return { type: "guess_word", word: action.word };
    }
    case "submit_drawing": {
      if (!Array.isArray(action.strokes) || action.strokes.length === 0) {
        return null;
      }
      if (action.strokes.length > 50) {
        return null;
      }
      const strokes: Stroke[] = [];
      for (const stroke of action.strokes) {
        const rec = asRecord(stroke);
        if (!rec || typeof rec.playerId !== "string") {
          return null;
        }
        const points = parseStrokePoints(rec.points);
        if (!points) {
          return null;
        }
        strokes.push({ playerId: rec.playerId, points });
      }
      return { type: "submit_drawing", strokes };
    }
    case "submit_guess": {
      if (typeof action.text !== "string") {
        return null;
      }
      return { type: "submit_guess", text: action.text };
    }
    case "give_clue": {
      if (
        typeof action.targetPlayerId !== "string" ||
        action.targetPlayerId.length === 0
      ) {
        return null;
      }
      const clue = parseHanabiClue(action.clue);
      if (!clue) {
        return null;
      }
      return { type: "give_clue", targetPlayerId: action.targetPlayerId, clue };
    }
    case "play_card": {
      if (typeof action.cardId !== "string" || action.cardId.length === 0) {
        return null;
      }
      return { type: "play_card", cardId: action.cardId };
    }
    case "discard_card": {
      if (typeof action.cardId !== "string" || action.cardId.length === 0) {
        return null;
      }
      return { type: "discard_card", cardId: action.cardId };
    }
    case "crew_begin_mission":
      return { type: "crew_begin_mission" };
    case "crew_play_card": {
      if (typeof action.cardId !== "string" || action.cardId.length === 0) {
        return null;
      }
      return { type: "crew_play_card", cardId: action.cardId };
    }
    case "crew_communicate": {
      if (typeof action.cardId !== "string" || action.cardId.length === 0) {
        return null;
      }
      if (action.signal !== "highest" && action.signal !== "lowest" && action.signal !== "only") {
        return null;
      }
      if (action.attribute !== "color" && action.attribute !== "rank") {
        return null;
      }
      return {
        type: "crew_communicate",
        cardId: action.cardId,
        signal: action.signal,
        attribute: action.attribute,
      };
    }
    default:
      return null;
  }
}

const HANABI_COLORS: HanabiColor[] = [
  "red",
  "yellow",
  "green",
  "blue",
  "white",
];
const HANABI_RANKS: HanabiRank[] = [1, 2, 3, 4, 5];

function parseHanabiClue(value: unknown): HanabiClue | null {
  const clue = asRecord(value);
  if (!clue || typeof clue.type !== "string") {
    return null;
  }
  if (clue.type === "color") {
    if (typeof clue.value !== "string") {
      return null;
    }
    if (!HANABI_COLORS.includes(clue.value as HanabiColor)) {
      return null;
    }
    return { type: "color", value: clue.value as HanabiColor };
  }
  if (clue.type === "rank") {
    if (
      typeof clue.value !== "number" ||
      !Number.isInteger(clue.value) ||
      !HANABI_RANKS.includes(clue.value as HanabiRank)
    ) {
      return null;
    }
    return { type: "rank", value: clue.value as HanabiRank };
  }
  return null;
}

function parseStrokePoints(value: unknown): StrokePoint[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) {
    return null;
  }
  const points: StrokePoint[] = [];
  for (const point of value) {
    const rec = asRecord(point);
    if (
      !rec ||
      typeof rec.x !== "number" ||
      typeof rec.y !== "number" ||
      !Number.isFinite(rec.x) ||
      !Number.isFinite(rec.y)
    ) {
      return null;
    }
    points.push({ x: rec.x, y: rec.y });
  }
  return points;
}

function isGameId(value: unknown): value is GameId {
  return (
    value === "fakeArtist" ||
    value === "telestrations" ||
    value === "pictionary" ||
    value === "hanabi" ||
    value === "crew"
  );
}

/** Accept only empty Standard settings objects: `{ kind }` and no extra keys. */
export function parseGameSettings(value: unknown): GameSettings | null {
  const rec = asRecord(value);
  if (!rec || !isGameId(rec.kind)) {
    return null;
  }
  const keys = Object.keys(rec);
  if (keys.length !== 1 || keys[0] !== "kind") {
    return null;
  }
  return { kind: rec.kind };
}
