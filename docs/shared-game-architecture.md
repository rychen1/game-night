# Game Night — Shared Game Architecture

## Source of Truth

```text
architecture.md
        ↓
shared-game-architecture.md   ← you are here
uiux.md / protocol.md
        ↓
games/*.md
        ↓
implementation
```

More specific documents override more general ones when they conflict.

Examples:

- This file defines the Review convention; `games/telestrations.md` defines
  Review as the complete telephone chain.
- This file defines optional timers; `games/hanabi.md` states Hanabi has no
  timer by default.

---

## Principle

**`RoomManager` / `WebSocketManager` remain game-agnostic.**

Game-specific rules belong in the game module (and registry metadata), never
in room or WebSocket orchestration beyond generic dispatch.

---

## Game interface

Canonical contract (`server/src/games/Game.ts`):

```ts
type Game = {
  setup(playerIds: string[]): void;
  canStart(playerCount: number): string | null; // null = ok; else error text
  getPublicState(): PublicGameState;
  getPrivateState(playerId: string): PrivateGameState;
  performAction(playerId: string, action: GameAction): void;
  onPlayerRemoved(playerId: string): void;
  isGameOver(): boolean;
  /** Epoch ms deadline for the current timed phase, or null if untimed. */
  getTimerDeadline(): number | null;
  /** Server deadline fired; advance via existing phase transitions if still applicable. */
  onTimer(): void;
};
```

Notes:

- Legal moves are projected into private state (e.g. `legalActions`) and
  re-validated in `performAction`.
- Terminal public state carries outcomes for the client Review UI.
- Untimed games (Hanabi, Crew) return `null` from `getTimerDeadline` and no-op
  `onTimer`.

`GameError` is thrown for illegal actions; infrastructure turns it into an
`error` message without crashing.

---

## Registry and metadata

`server/src/games/registry.ts` maps each `GameId` to:

| Field | Purpose |
|-------|---------|
| `title` / `description` | Lobby setup copy |
| `minPlayers` / `maxPlayers` | Launch threshold / room capacity (server join + lobby UI) |
| `fields` | Declarative setup controls (currently `[]`) |
| `create(settings)` | Construct module instance |

Helpers: `defaultSettings`, `validateSettings`, `describeSetup`, `createGame`,
`gameTitle`, `maxPlayersForGame`, `LOBBY_MAX_PLAYERS`.

Client catalog (`client/src/games/catalog.ts`) duplicates titles/descriptions/
ranges for the home picker and genres. Keep them aligned when adding a game.

### Conceptual Game Night metadata

Every game should have (conceptually — not necessarily new protocol fields):

| Concept | Source today |
|---------|----------------|
| title, description, min/max players | Registry + client catalog |
| genre | Client `HOME_GAME_GENRE` |
| settings / fields | Registry `fields` + settings union |
| uses a timer | Per-game docs + `getTimerDeadline` / `uxMeta` |
| gameplay history | Per-game History UI |
| end-of-game review | `GameResultsShell` + review body |
| conventional scoring | Only if the module already scores (e.g. Hanabi) |

Client helper: `client/src/games/uxMeta.ts` (`gameNightMeta`, `gameHowToPlay`)
documents UX flags and expanded How to Play copy without adding wire protocol
fields.

**Presentation:** shared `GameInfo` / `HowToPlay` for game information.
Short description (catalog) ≠ How to Play objective/turn/end (`uxMeta`).
**Game configuration** is a separate block (`Standard` when `fields` is empty).
**Room configuration** (visibility, create password) is separate from game
configuration and presented in its own Room panel via a compact
`RoomVisibilityFields` control (Public / Private grouped tightly).
No Markdown rendering in the normal UI.

**Room setup presentation:** shared `RoomPlayersSection` hierarchy —
Players → list → launch/capacity status (`Need X more` / `Ready when everyone
is ready` / `Lobby full` / `Too many players (max N)` when seated count
exceeds the selected game’s `maxPlayers`) → `X / Y ready` → Ready / Not Ready
action. Players prioritizes **minimum-player readiness** over a `current /
max` display (the list already shows who is present). `minPlayers` is the
launch threshold; `maxPlayers` is room capacity (join rejected server-side
when full; UI shows `Lobby full` at capacity). Display-name editing is inline
next to the current player's name (not a standalone form). Host-only
**Remove player** uses a compact `⋮` on other players’ rows (server-authorized
`remove_player`; same pathway as leave). No separate Ready section heading.
The game's static `min–max` range is shown on **home / create** only — lobby
Game Information omits it (`showPlayerRange={false}`); Players status does
not restate it.

**Pre-setup lobby:** before a game is selected, show Players (no
min/max/ready), host game picker or non-host waiting copy, and Leave — no
Game Information panel. Join capacity uses `LOBBY_MAX_PLAYERS` until setup.

**Room Lobby typography:** shared heading → content → secondary-status
hierarchy. Section titles (Players, How to play, Configuration) use
`.section-heading` inside `.section-stack` with clear spacing before primary
content (`.section-content` / `.section-body` or lists). Configuration values
(any label, not only `Standard`) are primary content — not metadata and not
flush against the heading. Occupancy and ready counts use `.section-status`.
Game title (`.game-title`) may stay more prominent. See [`uiux.md`](./uiux.md).

---

## Game UX Contract

Every Game Night game should generally use:

1. Common Game Night shell — page background + stacked major `SectionPanel`s
   (header → situation → board → actions → history → results → room)
2. Common start / briefing pattern (content game-owned)
3. Common player / seat representation (`GamePlayerList` / `RoomPlayersSection`
   + board seats as needed)
4. Common turn / phase status (`TurnStatus`)
5. Common primary action hierarchy (`GameActionArea`)
6. Common timer presentation when applicable (`PhaseTimer` urgency states)
7. Common error feedback (`ActionFeedback`)
8. Common connection / room-exit presentation (`GlobalStatusBanner` at app
   shell — outside SectionPanel; Connected hidden; Connecting… / Connection
   lost / leave / removed visible; dismissible client-side only)
9. Common waiting states (consistent copy)
10. Common History / Review conventions
11. Common Results shell (`GameResultsShell`)
12. Common game-over actions (`GameOverActions` / ready-check)
13. Common responsive / mobile hierarchy (panels stack; no forced overflow)
14. Shared accessibility conventions
15. Tabletop dashboard section hierarchy (page / major panel / in-panel content;
    restrained nesting) — see [`uiux.md`](./uiux.md)
16. Shared lobby setup: Game Information vs Players / Readiness separation
    (`GameInfo` + `RoomPlayersSection`)
17. Shared create-room: Game Information vs Room configuration separation
    (`GameInfo` + compact `RoomVisibilityFields`)

Game-specific rules, state, scoring, hidden information, and gameplay UI
remain owned by the game module.

> **Standardization applies to presentation and interaction patterns, not to
> game rules.**

Visual detail: [`uiux.md`](./uiux.md).

---

## Settings and setup

- Settings are a discriminated union keyed by `kind` matching `GameId`
- Current product: **Standard only** — `{ kind: gameId }` with no extra keys
- Host flow: `select_game` → optional `update_game_settings` → unanimous
  `set_ready` → host `start_game`
- `cancel_game_setup` clears selection and ready flags

**UX:** The host control for that action in the Room Lobby is labeled
**Change Game** (not “Back”), because it returns to game selection to pick a
different game rather than generic navigation.
- Custom variants belong in registry `fields` + settings types when designed;
  do not invent them ad hoc in RoomManager

### Readiness (generic room lifecycle)

Unanimous ready is **room infrastructure**, identical for every game:

- Players toggle `ready` via `set_ready` during setup or `GAME_OVER`
- Host Start Game / Play Again rejected unless every seated player is ready
- Becoming ready never auto-starts the game
- Return to Lobby stays host-only without a ready check
- Disconnect clears that player’s ready; reconnect restores server state

**UX:** In lobby setup, readiness is presented inside the shared Players /
Readiness section (`RoomPlayersSection`), not as a separate top-level card
with a duplicated player list. Behavior above is unchanged.

---

## Phases

Two layers:

1. **Room phases:** `LOBBY` | `GAME_RUNNING` | `GAME_OVER`
2. **Game phases:** owned entirely by the module (e.g. `DRAWING`, `PLAYING`,
   `REVEAL`, `RESULTS`, `ABORTED`, …)

RoomManager sets `GAME_OVER` when `game.isGameOver()` becomes true after an
action or player removal. It does not interpret game phase names.

---

## Actions and validation

1. Client sends `game_action`
2. RoomManager ensures the sender is in a running game
3. Module `performAction` validates phase, turn, and payload
4. Module updates authoritative state
5. Infrastructure broadcasts `room_state` and per-player `private_state`

Never apply optimistic rule enforcement that the server does not confirm.

---

## Public and private state

Each tick (broadcast), modules must:

- Return only publicly safe fields from `getPublicState`
- Return only that player’s allowed secrets from `getPrivateState`
- Reveal end-game secrets only in terminal phases (documented per game)

Shared drawing representation: stroke lists (`Stroke`) maintained by the
module; clients render via shared canvas.

---

## Results, Play Again, Return to Lobby

When `isGameOver()`:

- Room → `GAME_OVER` (ready flags cleared)
- Client shows that game’s **Review** plus the shared ready-check

Host:

- `play_again` — requires all seated players ready; then new instance via
  `createGame` with same id/settings; room → `GAME_RUNNING`
- `return_to_lobby` — host-only, **no** ready requirement; clear game/setup;
  room → `LOBBY`

---

## Player removal vs disconnect

| Event | Room behavior | Game behavior |
|-------|---------------|---------------|
| Socket disconnect | `connected: false` | None |
| `leave_room` | Remove player; host handoff; delete empty room | `onPlayerRemoved(playerId)` |
| `remove_player` | Host-only; target must be another seated player in the room; then same pathway as `leave_room`; target gets `left_room` (`reason: "removed"`) — no announcement to others | Same `onPlayerRemoved` as leave |

Abort / continue policies are **per game** (see `games/*.md`). Do not
centralize “always abort” in RoomManager. Host remove is generic room
infrastructure — not per-game kick rules. Removed players may rejoin if the
room remains joinable. Player-facing exit/connection states use a shared
**global status banner** at the app shell (outside `SectionPanel` / tabletop
content): Connection lost, Connecting…, You left the room, You were removed
from the room. Banners are dismissible presentation-only (see
[`uiux.md`](./uiux.md)).

---

## Reconnect behavior (games-facing)

Reconnect restores identity and re-sends current public + private projections.
Modules should not require special reconnect hooks if state is fully
recoverable from `getPublicState` / `getPrivateState`.

---

## In-game History vs End-of-game Review

| | In-game History | End-of-game Review |
|--|-----------------|--------------------|
| When | Active play phases | Terminal phases (`RESULTS` / `ABORTED` / Telestrations `REVEAL`) |
| Tone | Compact, collapsible, subordinate | Inside shared results shell; spacious payoff |
| Info | Already-public only | May reveal finals (hands, votes, chains, words) |
| Implementation | Per-game UI + existing public fields | Per-game review body inside `GameResultsShell` |

A game does **not** need a generic History panel if another representation
communicates better. Shared requirement is the **convention** (shell,
typography, subdued vs prominent), not one forced component.

### Shared results / score presentation

Client `GameResultsShell` standardizes end-game hierarchy (heading → outcome →
optional Scores → Review → footer). Scoring **calculations** remain in each
game module. Games without conventional scores omit the Scores block (e.g.
Crew mission outcome, Telestrations chains). Do not invent points for visual
consistency.

Visual language: [`uiux.md`](./uiux.md).

---

## Optional timers

- Optional; game-specific whether a phase is timed
- When used: shared UX (`PhaseTimer` in phase status; urgency states)
- Game module sets `endsAt` and implements `onTimer()` expiry using **existing**
  phase transitions
- Public state may expose `endsAt` (epoch ms) while the phase is timed
- Client displays from `endsAt`; never advances phase locally
- RoomManager: generic `getTimerDeadline` → `setTimeout` → `onTimer` → broadcast
  (via listener). **No game-specific timer branches** in RoomManager or
  WebSocketManager
- No timer settings UI; Standard fixed durations only (see game docs)
- Hanabi and Crew: untimed (`getTimerDeadline()` → `null`)

Current Standard durations:

| Game | Timed phases | Duration | On expiry |
|------|--------------|----------|-----------|
| Fake Artist | Each drawing turn | 20s | Skip turn (advance queue) |
| Telestrations | DRAWING / GUESSING | 60s / 35s | Auto-complete missing submits → advance |
| Pictionary | DRAWING round | 90s | Skip unsolved drawer → next / RESULTS |

---

## Server-authoritative game state

The module is the source of truth for that match. Clients mirror projections.
Word lists, decks, missions, RNGs, and scoring live on the server.

---

## How to add a new game

1. **Protocol** — add `GameId`, settings, public/private state, actions;
   update parsers; mirror on client (`protocol.md`)
2. **Server module** — implement `Game`; word/deck assets as needed
3. **Registry** — metadata, `fields`, `create`
4. **Client** — catalog entry + genre; screen using shared shell conventions
   and the **Game UX Contract**
5. **Docs** — `docs/games/<id>.md`
6. **Wire-up** — route screen from room `publicGame.kind` only; no new
   RoomManager branches for rules

Checklist: hidden-info audit, leave/abort policy, history/review plan, timer
stance, Standard settings default, UX contract (turn status, player list,
actions, errors, how-to-play content).

---

## Infrastructure boundary (summary)

RoomManager may know: selected `gameId`, opaque `Game` instance, setup view
from registry, player roster, room phase, and a **generic** deadline schedule
(`getTimerDeadline` / `onTimer`).

RoomManager must not know: Fake Artist vote resolution, Hanabi fuse math, Crew
follow-suit, Telestrations book rotation, Pictionary word pick, per-game timer
durations, etc.

---

## Related documents

- [`architecture.md`](./architecture.md)
- [`protocol.md`](./protocol.md)
- [`uiux.md`](./uiux.md)
- [`games/`](./games/)
