import {
  createGame,
  defaultSettings,
  describeSetup,
  gameTitle,
  LOBBY_MAX_PLAYERS,
  maxPlayersForGame,
  validateSettings,
} from "../games/createGame.ts";
import { createPlayer, type Player } from "../players/Player.ts";
import type {
  GameAction,
  GameId,
  GameSettings,
  RoomListItem,
  RoomStatePayload,
  RoomVisibility,
} from "../protocol/messages.ts";
import { hashPassword, verifyPassword } from "./passwords.ts";
import type { Room } from "./Room.ts";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_FAILED = "Could not join room";

export class RoomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoomError";
  }
}

export type CreateRoomOptions = {
  visibility?: RoomVisibility;
  password?: string;
};

export class RoomManager {
  private roomsByCode = new Map<string, Room>();
  private playersById = new Map<string, Player>();
  private playersByToken = new Map<string, Player>();
  private roomTimerHandles = new Map<string, ReturnType<typeof setTimeout>>();
  private onRoomTimer: ((room: Room) => void) | null = null;

  /** Generic hook so WebSocketManager can broadcast after a deadline fires. */
  setRoomTimerListener(listener: (room: Room) => void): void {
    this.onRoomTimer = listener;
  }

  createRoom(
    name: string,
    options: CreateRoomOptions = {},
  ): { player: Player; room: Room } {
    const visibility = options.visibility ?? "public";
    let passwordHash: string | null = null;
    if (visibility === "private") {
      const password = options.password;
      if (!password || password.length === 0) {
        throw new RoomError("Private rooms require a password");
      }
      passwordHash = hashPassword(password);
    }

    const code = this.generateRoomCode();
    const player = createPlayer(name, code);
    const room: Room = {
      code,
      hostPlayerId: player.id,
      players: new Map([[player.id, player]]),
      phase: "LOBBY",
      visibility,
      passwordHash,
      gameId: null,
      gameSettings: null,
      setup: null,
      game: null,
    };
    this.roomsByCode.set(code, room);
    this.indexPlayer(player);
    return { player, room };
  }

  joinRoom(
    roomCode: string,
    name: string,
    password?: string,
  ): { player: Player; room: Room } {
    const room = this.roomsByCode.get(roomCode);
    if (!room) {
      throw new RoomError(JOIN_FAILED);
    }
    if (room.phase !== "LOBBY") {
      throw new RoomError("This room has already started a game");
    }
    const maxPlayers = this.maxPlayersForRoom(room);
    if (room.players.size >= maxPlayers) {
      throw new RoomError("This room is full");
    }
    if (room.visibility === "private") {
      if (!room.passwordHash) {
        throw new RoomError(JOIN_FAILED);
      }
      if (password === undefined || password.length === 0) {
        throw new RoomError("Password required");
      }
      if (!verifyPassword(password, room.passwordHash)) {
        throw new RoomError(JOIN_FAILED);
      }
    }
    const player = createPlayer(name, room.code);
    room.players.set(player.id, player);
    this.indexPlayer(player);
    return { player, room };
  }

  listRooms(): RoomListItem[] {
    return [...this.roomsByCode.values()]
      .filter((room) => room.visibility === "public")
      .map((room) => this.toListItem(room))
      .sort((a, b) => a.roomCode.localeCompare(b.roomCode));
  }

  reconnect(reconnectToken: string): { player: Player; room: Room } {
    const player = this.playersByToken.get(reconnectToken);
    if (!player) {
      throw new RoomError("Unknown reconnect token");
    }
    const room = this.roomsByCode.get(player.roomCode);
    if (!room) {
      throw new RoomError("Room no longer exists");
    }
    player.connected = true;
    return { player, room };
  }

  setName(playerId: string, name: string): { player: Player; room: Room } {
    const { player, room } = this.requirePlayerRoom(playerId);
    player.name = name;
    return { player, room };
  }

  selectGame(playerId: string, gameId: GameId): { player: Player; room: Room } {
    const { player, room } = this.requireHostLobby(playerId);
    room.setup = { gameId, settings: defaultSettings(gameId) };
    this.clearAllReady(room);
    return { player, room };
  }

  updateGameSettings(
    playerId: string,
    settings: GameSettings,
  ): { player: Player; room: Room } {
    const { player, room } = this.requireHostLobby(playerId);
    if (!room.setup) {
      throw new RoomError("Select a game first");
    }
    const validated = validateSettings(room.setup.gameId, settings);
    if (!validated) {
      throw new RoomError("Invalid game settings");
    }
    room.setup = { gameId: room.setup.gameId, settings: validated };
    this.clearAllReady(room);
    return { player, room };
  }

  cancelGameSetup(playerId: string): { player: Player; room: Room } {
    const { player, room } = this.requireHostLobby(playerId);
    room.setup = null;
    this.clearAllReady(room);
    return { player, room };
  }

  setReady(
    playerId: string,
    ready: boolean,
  ): { player: Player; room: Room } {
    const { player, room } = this.requirePlayerRoom(playerId);
    if (!this.isReadinessPhase(room)) {
      throw new RoomError("Ready is only available during setup or after a game");
    }
    player.ready = ready;
    return { player, room };
  }

  startGame(playerId: string): { player: Player; room: Room } {
    const { player, room } = this.requireHostLobby(playerId);
    if (!room.setup) {
      throw new RoomError("Select a game first");
    }
    this.requireEveryoneReady(room);
    const { gameId, settings } = room.setup;
    const game = createGame(gameId, settings);
    const startError = game.canStart(room.players.size);
    if (startError) {
      throw new RoomError(startError);
    }
    game.setup([...room.players.keys()]);
    room.gameId = gameId;
    room.gameSettings = settings;
    room.setup = null;
    room.game = game;
    room.phase = "GAME_RUNNING";
    this.clearAllReady(room);
    this.rescheduleRoomTimer(room);
    return { player, room };
  }

  playAgain(playerId: string): { player: Player; room: Room } {
    const { player, room } = this.requirePlayerRoom(playerId);
    if (player.id !== room.hostPlayerId) {
      throw new RoomError("Only the host can start another round");
    }
    if (room.phase !== "GAME_OVER") {
      throw new RoomError("Play again is only available after the game ends");
    }
    this.requireEveryoneReady(room);
    this.beginGame(room);
    this.clearAllReady(room);
    return { player, room };
  }

  private beginGame(room: Room): void {
    if (room.gameId === null || room.gameSettings === null) {
      throw new RoomError("No game selected");
    }
    const game = createGame(room.gameId, room.gameSettings);
    const startError = game.canStart(room.players.size);
    if (startError) {
      throw new RoomError(startError);
    }
    game.setup([...room.players.keys()]);
    room.game = game;
    room.phase = "GAME_RUNNING";
    this.rescheduleRoomTimer(room);
  }

  performGameAction(
    playerId: string,
    action: GameAction,
  ): { player: Player; room: Room } {
    const { player, room } = this.requirePlayerRoom(playerId);
    if (!room.game || room.phase === "LOBBY") {
      throw new RoomError("No game is in progress");
    }
    room.game.performAction(playerId, action);
    if (room.game.isGameOver()) {
      room.phase = "GAME_OVER";
      this.clearAllReady(room);
    }
    this.rescheduleRoomTimer(room);
    return { player, room };
  }

  returnToLobby(playerId: string): { player: Player; room: Room } {
    const { player, room } = this.requirePlayerRoom(playerId);
    if (player.id !== room.hostPlayerId) {
      throw new RoomError("Only the host can return to the lobby");
    }
    if (room.phase !== "GAME_OVER") {
      throw new RoomError("The game is still in progress");
    }
    this.clearRoomTimer(room.code);
    room.game = null;
    room.gameId = null;
    room.gameSettings = null;
    room.setup = null;
    room.phase = "LOBBY";
    this.clearAllReady(room);
    return { player, room };
  }

  disconnect(playerId: string): Room | null {
    const player = this.playersById.get(playerId);
    if (!player) {
      return null;
    }
    player.connected = false;
    player.ready = false;
    return this.roomsByCode.get(player.roomCode) ?? null;
  }

  leaveRoom(playerId: string): Room | null {
    const { player, room } = this.requirePlayerRoom(playerId);
    room.players.delete(player.id);
    this.playersById.delete(player.id);
    this.playersByToken.delete(player.reconnectToken);

    if (room.players.size === 0) {
      this.clearRoomTimer(room.code);
      this.roomsByCode.delete(room.code);
      return null;
    }

    if (room.hostPlayerId === player.id) {
      const remaining = [...room.players.values()];
      const nextHost =
        remaining.find((candidate) => candidate.connected) ?? remaining[0];
      if (nextHost === undefined) {
        this.clearRoomTimer(room.code);
        this.roomsByCode.delete(room.code);
        return null;
      }
      room.hostPlayerId = nextHost.id;
    }

    if (room.game) {
      room.game.onPlayerRemoved(player.id);
      if (room.game.isGameOver()) {
        room.phase = "GAME_OVER";
        this.clearAllReady(room);
      }
      this.rescheduleRoomTimer(room);
    }

    return room;
  }

  /**
   * Host-only removal of another seated player.
   * Reuses leaveRoom so games apply the same onPlayerRemoved behavior.
   */
  removePlayer(
    hostPlayerId: string,
    targetPlayerId: string,
  ): { room: Room | null } {
    const { player: host, room } = this.requirePlayerRoom(hostPlayerId);
    if (host.id !== room.hostPlayerId) {
      throw new RoomError("Only the host can remove a player");
    }
    if (targetPlayerId === host.id) {
      throw new RoomError("You cannot remove yourself");
    }
    const target = room.players.get(targetPlayerId);
    if (!target || target.roomCode !== room.code) {
      throw new RoomError("Player is not in this room");
    }
    return { room: this.leaveRoom(targetPlayerId) };
  }

  getPlayer(playerId: string): Player | undefined {
    return this.playersById.get(playerId);
  }

  toPublicState(room: Room): RoomStatePayload {
    const players = [...room.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      connected: player.connected,
      isHost: player.id === room.hostPlayerId,
      ready: player.ready,
    }));
    const state: RoomStatePayload = {
      roomCode: room.code,
      phase: room.phase,
      hostPlayerId: room.hostPlayerId,
      players,
      visibility: room.visibility,
    };
    if (room.setup) {
      state.setup = describeSetup(room.setup.gameId, room.setup.settings);
    }
    if (room.game) {
      return { ...state, publicGame: room.game.getPublicState() };
    }
    return state;
  }

  private clearAllReady(room: Room): void {
    for (const player of room.players.values()) {
      player.ready = false;
    }
  }

  private isReadinessPhase(room: Room): boolean {
    if (room.phase === "GAME_OVER") {
      return true;
    }
    return room.phase === "LOBBY" && room.setup !== null;
  }

  private requireEveryoneReady(room: Room): void {
    const players = [...room.players.values()];
    if (players.length === 0 || players.some((player) => !player.ready)) {
      throw new RoomError("Everyone must be ready");
    }
  }

  private requireHostLobby(playerId: string): { player: Player; room: Room } {
    const { player, room } = this.requirePlayerRoom(playerId);
    if (player.id !== room.hostPlayerId) {
      throw new RoomError("Only the host can configure the game");
    }
    if (room.phase !== "LOBBY") {
      throw new RoomError("The game has already started");
    }
    return { player, room };
  }

  private requirePlayerRoom(playerId: string): { player: Player; room: Room } {
    const player = this.playersById.get(playerId);
    if (!player) {
      throw new RoomError("You are not in a room");
    }
    const room = this.roomsByCode.get(player.roomCode);
    if (!room) {
      throw new RoomError("Room no longer exists");
    }
    return { player, room };
  }

  private maxPlayersForRoom(room: Room): number {
    if (room.setup) {
      return maxPlayersForGame(room.setup.gameId);
    }
    if (room.gameId) {
      return maxPlayersForGame(room.gameId);
    }
    return LOBBY_MAX_PLAYERS;
  }

  private toListItem(room: Room): RoomListItem {
    const playerCount = room.players.size;
    const maxPlayers = this.maxPlayersForRoom(room);
    const gameId = room.setup?.gameId ?? room.gameId;
    const setup = room.setup
      ? describeSetup(room.setup.gameId, room.setup.settings)
      : null;
    return {
      roomCode: room.code,
      playerCount,
      maxPlayers,
      status: room.phase,
      visibility: "public",
      gameId,
      gameTitle: gameId ? gameTitle(gameId) : null,
      setup,
      joinable: room.phase === "LOBBY" && playerCount < maxPlayers,
    };
  }

  private indexPlayer(player: Player): void {
    this.playersById.set(player.id, player);
    this.playersByToken.set(player.reconnectToken, player);
  }

  private clearRoomTimer(roomCode: string): void {
    const handle = this.roomTimerHandles.get(roomCode);
    if (handle !== undefined) {
      clearTimeout(handle);
      this.roomTimerHandles.delete(roomCode);
    }
  }

  /**
   * Game-agnostic scheduling: read deadline from the game module, fire onTimer,
   * then rebroadcast via the optional listener. No game-specific branches.
   */
  private rescheduleRoomTimer(room: Room): void {
    this.clearRoomTimer(room.code);
    if (!room.game || room.phase !== "GAME_RUNNING") {
      return;
    }
    const deadline = room.game.getTimerDeadline();
    if (deadline === null) {
      return;
    }
    const delay = Math.max(0, deadline - Date.now());
    const expectedDeadline = deadline;
    const handle = setTimeout(() => {
      this.roomTimerHandles.delete(room.code);
      if (!room.game || room.phase !== "GAME_RUNNING") {
        return;
      }
      const current = room.game.getTimerDeadline();
      if (current === null || current !== expectedDeadline) {
        this.rescheduleRoomTimer(room);
        return;
      }
      room.game.onTimer();
      if (room.game.isGameOver()) {
        room.phase = "GAME_OVER";
        this.clearAllReady(room);
      }
      this.rescheduleRoomTimer(room);
      this.onRoomTimer?.(room);
    }, delay);
    this.roomTimerHandles.set(room.code, handle);
  }

  private generateRoomCode(): string {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      let code = "";
      for (let i = 0; i < 4; i += 1) {
        const index = Math.floor(Math.random() * CODE_ALPHABET.length);
        const char = CODE_ALPHABET[index];
        if (char === undefined) {
          throw new RoomError("Could not generate a unique room code");
        }
        code += char;
      }
      if (!this.roomsByCode.has(code)) {
        return code;
      }
    }
    throw new RoomError("Could not generate a unique room code");
  }
}
