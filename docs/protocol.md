# Game Night — Client / Server Protocol

## Source of Truth

```text
architecture.md
        ↓
protocol.md              ← you are here (wire protocol & state shapes)
uiux.md / shared-game-architecture.md
        ↓
games/*.md
        ↓
implementation
```

More specific documents override more general ones when they conflict.

**Canonical types:** `server/src/protocol/messages.ts` and the mirrored
`client/src/network/messages.ts`. If this document and those files disagree,
**the TypeScript sources win** — update this doc to match.

---

## WebSocket architecture

- Primary realtime channel: WebSocket JSON messages
- Connection stays open while the player is in a session
- Express serves HTTP health (`GET /health`) and, when present, the built
  client from `client/dist` (static + SPA fallback). Gameplay traffic is
  WebSocket on `/ws`. See
  [`architecture.md`](./architecture.md#deployment-assumptions-current).
- On connect, the server may assign identity; clients send typed messages;
  server replies with typed messages and broadcasts `room_state` as needed

All messages are JSON objects with an explicit string `type` discriminant.

---

## Message conventions

- Discriminated unions on `type`
- Game-specific public/private state and actions use nested `kind` / action
  `type` discriminants
- Invalid client messages produce `{ type: "error", message }` rather than
  crashing the server
- Protocol is extensible by adding union members; parsers must reject unknown
  or malformed payloads

---

## Hidden information rule

**Never send secret data to unauthorized clients.**

The server constructs:

- **Public state** — safe for every player in the room
- **Private state** — safe for exactly one `playerId`

Do not ship the full secret game blob and rely on the UI to hide fields.

---

## Client → server messages

| `type` | Purpose | Notes |
|--------|---------|--------|
| `create_room` | Create room | `name`, `visibility`, optional `password` |
| `join_room` | Join by code | `roomCode`, `name`, optional `password` |
| `list_rooms` | Public room browser | |
| `set_name` | Update display name | 1–32 chars |
| `select_game` | Host selects game in lobby | `gameId` |
| `update_game_settings` | Host updates setup | `settings` must match selected game |
| `cancel_game_setup` | Host clears selected game | Clears ready flags |
| `set_ready` | Mark self ready / not ready | Setup or `GAME_OVER` only |
| `start_game` | Host starts | Lobby + setup + player count ok + **all seated ready** |
| `game_action` | In-game action | `{ action: GameAction }` |
| `play_again` | Host, game over | Same game + settings; **all seated ready** |
| `return_to_lobby` | Host, game over | Clears game; **no** ready requirement |
| `leave_room` | Leave | Clears reconnect binding for that seat |
| `remove_player` | Host removes another seated player | `playerId`; same removal pathway as leave; target gets `left_room` with `reason: "removed"` |
| `reconnect` | Restore identity | `reconnectToken` |
| `ping` | Keepalive | |

Room codes: 4 alphanumeric characters (normalized uppercase).

Visibility: `"public"` \| `"private"`. Private create/join requires password
(length limits enforced in parser).

---

## Server → client messages

| `type` | Purpose |
|--------|---------|
| `welcome` | `playerId`, `reconnectToken` (e.g. after reconnect) |
| `room_created` | `roomCode`, `playerId`, `reconnectToken` |
| `room_state` | Full `RoomStatePayload` |
| `private_state` | Per-player `PrivateGameState` when a game is running |
| `game_started` | Hint that a game began (state also in `room_state`) |
| `left_room` | Client left voluntarily or was removed by the host (`reason`) |
| `room_list` | Public rooms snapshot |
| `error` | Human-readable failure |
| `pong` | Response to `ping` |

There are **no** dedicated `player_disconnected` / `player_reconnected`
messages. Connection status is carried on `room_state.players[].connected`.

There is **no** separate top-level `game_state` message. Public game state is
`room_state.state.publicGame`.

`left_room` carries a reason so the client can distinguish intentional exits:

```ts
type LeftRoomReason = "left" | "removed";
type LeftRoomMessage = { type: "left_room"; reason: LeftRoomReason };
```

| `reason` | Cause |
|----------|--------|
| `"left"` | Client sent `leave_room` |
| `"removed"` | Host sent `remove_player` targeting this client |

Remaining players are **not** sent a kick/removal announcement — they only
receive the updated `room_state`.

---

## Room state

```ts
type RoomPhase = "LOBBY" | "GAME_RUNNING" | "GAME_OVER";
type RoomVisibility = "public" | "private";

type PublicPlayer = {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  ready: boolean;
};

type RoomStatePayload = {
  roomCode: string;
  phase: RoomPhase;
  hostPlayerId: string;
  players: PublicPlayer[];
  visibility: RoomVisibility;
  publicGame?: PublicGameState;
  setup?: GameSetupView;
};
```

### Readiness (room infrastructure)

`ready` is part of generic room/player state — not game modules.

| Rule | Behavior |
|------|----------|
| Who can toggle | Any seated player via `set_ready` during setup (`LOBBY` + `setup`) or `GAME_OVER` |
| Start Game | Host + setup + canStart + **every seated player `ready === true`** |
| Play Again | Host + `GAME_OVER` + **every seated player ready** |
| Auto-start | Never — final Ready only enables the host button |
| Return to Lobby | Host only; ignores readiness |
| Disconnect | Sets `connected: false` and `ready: false` |
| Leave / host `remove_player` | Player removed from room and readiness set; reconnect token cleared |
| Select / cancel setup / settings change / game start / play again / return to lobby / entering GAME_OVER | Clears all ready flags as appropriate |
| Reconnect | Client receives server `ready` from `room_state`; no client-side authority |

### Room list item (public browser only)

```ts
type RoomListItem = {
  roomCode: string;
  playerCount: number;
  maxPlayers: number;
  status: RoomPhase;
  visibility: "public";
  gameId: GameId | null;
  gameTitle: string | null;
  setup: GameSetupView | null;
  joinable: boolean; // typically LOBBY and not full
};
```

Private rooms are omitted from `room_list`.

---

## Game ids, settings, setup

```ts
type GameId =
  | "fakeArtist"
  | "telestrations"
  | "pictionary"
  | "hanabi"
  | "crew";
```

Current **Standard** settings are kind-only objects with no extra keys:

```ts
type FakeArtistSettings = { kind: "fakeArtist" };
// …likewise for telestrations, pictionary, hanabi, crew
```

Setup view returned on room state / room list:

```ts
type GameSetupView = {
  gameId: GameId;
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  settings: GameSettings;
  fields: GameSetupField[]; // currently empty for all games
};
```

`GameSetupField` supports future `boolean` / `number` / `select` fields.
Until fields exist, the UI presents **Standard**.

---

## Public and private game state

Discriminated by `kind`:

| `kind` | Public type | Private type |
|--------|-------------|--------------|
| `fakeArtist` | `FakeArtistPublicState` | `FakeArtistPrivateState` |
| `telestrations` | `TelestrationsPublicState` | `TelestrationsPrivateState` |
| `pictionary` | `PictionaryPublicState` | `PictionaryPrivateState` |
| `hanabi` | `HanabiPublicState` | `HanabiPrivateState` |
| `crew` | `CrewPublicState` | `CrewPrivateState` |
| `dummy` | legacy test kind | legacy test kind |

Field-level visibility (what is secret until RESULTS, etc.) is defined in
[`games/*.md`](./games/) and must match `getPublicState` /
`getPrivateState` in each game module.

Shared drawing types:

```ts
type StrokePoint = { x: number; y: number }; // typically normalized 0–1
type Stroke = { playerId: string; points: StrokePoint[] };
```

---

## Game actions

Wrapped as:

```json
{ "type": "game_action", "action": { "type": "…", … } }
```

Current action `type` values:

| Action | Games |
|--------|--------|
| `submit_stroke` | Fake Artist, Pictionary |
| `vote` | Fake Artist |
| `guess_word` | Fake Artist |
| `submit_drawing` | Telestrations |
| `submit_guess` | Telestrations, Pictionary |
| `give_clue` | Hanabi |
| `play_card` | Hanabi |
| `discard_card` | Hanabi |
| `crew_begin_mission` | Crew |
| `crew_play_card` | Crew |
| `crew_communicate` | Crew |

Legal actions for the current player are typically mirrored in private state
as `legalActions` (and richer hints such as `playableCardIds`). The server
still validates every action.

---

## Reconnect protocol

1. `room_created` or `welcome` includes `reconnectToken`
2. Client persists token
3. New socket → send `{ "type": "reconnect", "reconnectToken": "…" }`
4. Success → `welcome` + current `room_state` (+ `private_state` if in game)
5. Failure → `error` (client should clear bad token)
6. `leave_room` → `left_room` with `reason: "left"`; host `remove_player` →
   target gets `left_room` with `reason: "removed"`; that seat’s reconnect
   token no longer maps to the room

Disconnect without leave: `connected: false` on the player; game continues
until leave/abort rules apply. Disconnect is **not** a `left_room` event.

---

## Errors

```ts
type ErrorMessage = { type: "error"; message: string };
```

Used for parse failures, authorization (not host — including unauthorized
`remove_player`), capacity (including joining a room already at the selected
game’s `maxPlayers` — e.g. `This room is full`), bad password, illegal game
actions (`GameError` messages), unknown reconnect tokens, etc.

---

## Timers (protocol)

Timed games may include an optional **`endsAt: number`** on public state
(epoch milliseconds, server clock).

| Game public state | When `endsAt` is present |
|-------------------|--------------------------|
| `fakeArtist` | `phase === "DRAWING"` (per stroke turn) |
| `telestrations` | `phase === "DRAWING"` or `"GUESSING"` |
| `pictionary` | `phase === "DRAWING"` |
| `hanabi` / `crew` | Never |

Rules:

- Client displays countdown from `endsAt`; never decides phase expiry
- Expiry transitions are performed by the game module’s `onTimer()` on the server
- Reconnect: client receives current `room_state` including `endsAt` and recomputes remaining time
- RoomManager only schedules from `Game.getTimerDeadline()` / calls `onTimer()` — no per-game timer logic

See [`uiux.md`](./uiux.md) and [`shared-game-architecture.md`](./shared-game-architecture.md).

---

## Extensibility checklist

When adding a game or feature:

1. Extend `GameId`, settings, public/private state, and `GameAction` unions
2. Update `parseClientMessage` / `parseGameSettings` validation
3. Mirror types on the client
4. Register the game and document it under `games/`
5. Keep RoomManager free of the new rules

---

## Related documents

- [`architecture.md`](./architecture.md) — authority model
- [`shared-game-architecture.md`](./shared-game-architecture.md) — game module contract
- [`games/*.md`](./games/) — per-game state and actions in detail
