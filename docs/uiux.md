# Game Night — UI / UX Specification

## Source of Truth

```text
architecture.md
        ↓
uiux.md                  ← you are here
protocol.md / shared-game-architecture.md
        ↓
games/*.md
        ↓
implementation
```

More specific documents override more general ones when they conflict.

Examples:

- This file defines common timer appearance; `games/the-crew.md` decides Crew
  does not use a timer by default.
- This file defines Review as a prominent end-of-game convention;
  `games/telestrations.md` defines Review as the telephone-chain gallery.

---

## Principle

**Consistent shell, game-specific center.**

Every game should feel like part of the same product. Games must not be forced
to look or behave identically. Preserve game identity in the main play surface
(boards, cards, drawings, missions) while sharing shell, typography, panels,
status treatments, history/review patterns, and game-over controls.

Four related platform conventions:

1. Shared game shell / layout
2. In-game history when useful
3. End-of-game Review when meaningful
4. Optional timers with common presentation

**Standardization applies to presentation and interaction patterns, not to
game rules.** See the **Game UX Contract** in
[`shared-game-architecture.md`](./shared-game-architecture.md).

---

## Typography

| Role | Family | CSS variable |
|------|--------|--------------|
| Display / brand / game titles | **Fraunces** (serif) | `--font-display` |
| UI chrome / buttons / section labels | **Source Sans 3** | `--font-ui` |
| Body / secondary copy | **Source Sans 3** | `--font-body` |
| Codes / monospace | system mono stack | `--mono` |

### Type scale

Hierarchy: hero > screen > game > section > ui > meta

| Token | Typical use |
|-------|-------------|
| `--type-hero` | Home brand (“Game Night”) |
| `--type-screen` | Screen titles (lobby, game name) |
| `--type-game` | In-game display emphasis |
| `--type-section` | Section labels, history summary |
| `--type-ui` | Controls, forms |
| `--type-meta` | Secondary / history list / badges |

Line heights: `--lh-hero`, `--lh-heading`, `--lh-body`, `--lh-ui`.  
Tracking: `--track-display-wide`, `--track-display`, `--track-section`,
`--track-button`, `--track-code`.

---

## Color and surfaces

| Token | Role (light) |
|-------|----------------|
| `--color-background` | Application backdrop (`#eaf4f8` light blue) — **page** level |
| `--social-bg` | Major section panel surface (warm off-white) |
| `--bg` | Nested surfaces / inputs (not nested cards) |
| `--border` / `--panel-border` | Dividers and panel outlines |
| `--panel-radius` / `--panel-pad` / `--panel-gap` | Shared panel geometry and stack spacing |
| `--panel-shadow` / `--panel-emphasis-shadow` | Restrained elevation |
| `--accent` | Primary button / focus / emphasis accent |
| `--code-bg` | Badge / chip fill |

Dark `prefers-color-scheme` variants exist; product design is light-first.
Game-specific palettes (Hanabi suits, Crew suits, genre cards) may extend
these tokens locally.

---

## Section hierarchy (tabletop dashboard)

Three visual levels — keep them distinct:

### 1. Page

The light-blue application background (`--color-background`). Do not replace
it with a full-bleed white sheet.

### 2. Major sections

Each major concept is a **separate panel** (`.panel` / `SectionPanel`) on the
page background, stacked with `.game-stack` (or `--wide` / `--table` widths):

- consistent radius (`--panel-radius`), padding (`--panel-pad`), gap
  (`--panel-gap`)
- subtle border + restrained shadow (`--panel-shadow`)
- optional `.section-panel--emphasis` for “what’s happening now”, the player’s
  actionable area, or end-game Results

Examples of major sections: current situation, mission/objective, tasks,
board/table, own hand + primary action, players/room chrome, history, results.

Do **not** force identical panel layouts per game — shared grammar, not clones.

### 3. Content inside panels

Prefer headings, whitespace, dividers, badges, and typography.

Avoid nested cards: turn status, how-to-play, and action areas should read as
**content** (dividers / accent rules), not rounded rectangles stacked inside
the panel.

---

## Information hierarchy

Within a screen, communicate in this order of emphasis:

1. What is happening now
2. What the player needs to do
3. The player’s available action
4. Supporting information
5. History / secondary information

When it is your turn, emphasize the actionable panel. When waiting, emphasize
turn/status. When the game is over, Results is the dominant panel.

---

## Shared components language

Reuse across home, lobby, and games:

- **Typography roles** — `.section-heading` / `.section-stack` /
  `.section-content` / `.section-body` / `.section-status` for Room Lobby
  heading → content → secondary-status hierarchy
- **Panels** — major sections only (`.panel` / `SectionPanel`); stack with
  `.game-stack`
- **Buttons** — primary accent; `.secondary` for Leave / Return to lobby
- **Badges / chips** — `.tags em` pill treatment for you / host / connected /
  turn / voted / submitted
- **Status** — `.status`, `.ok`, `.off`, `.error` / `ActionFeedback`
- **Spacing** — consistent gaps inside panels; avoid unrelated floating chrome
- **Selected / hover / disabled** — buttons and interactive seats follow shared
  border/background affordances; disabled controls do not look actionable
- **Room code** — `.room-code` with tabular numerals and `--track-code`; prefer
  this treatment everywhere a code is shown

---

## Home screen

First viewport composition:

1. Brand: **Game Night** (hero typography)
2. Short tagline
3. Games-first launcher (`GamePickerGrid`)
4. Secondary: Join (name + room code + optional password) and Browse rooms

Do not turn the home hero into a dashboard of stats or schedules.

### Game picker

- Two-column grid on desktop; single column on narrow viewports
- Cards show title, short description, player range
- **Genre color coding** (client catalog):
  - Drawing & Guessing — warm cream card (`game-card--drawingGuessing`):
    Pictionary, Telestrations, Fake Artist
  - Cooperative — green card (`game-card--cooperative`): Hanabi, Crew
- Creating a room: pick game → create-room flow (stacked **Game Information**
  then **Room** panels) → enter lobby with that game selected

### Create room (shared)

Separate **game** configuration from **room** configuration:

1. **Game Information** (`GameInfo`) — title, short description, static player
   range, How to Play, **game** Configuration (`Standard` today)
2. **Room** — your name, **Room visibility** (Public / Private), optional
   password for private rooms, Create room

**Room visibility is room-level configuration** and is presented separately
from game Configuration (`RoomVisibilityFields`). Present Public / Private as a
**compact grouped control** (side-by-side options, not widely spaced stacked
rows). Public rooms appear in Browse Rooms; private rooms are not listed and
require the room password to join. Behavior is unchanged — only presentation.

---

## Lobby and setup

- Header: “Room Lobby” + centered **Room code: XXXX** (`.room-code`)
- Private rooms: visibility badge; password required on join (not listed in
  browser)

### Pre-setup lobby (no game selected)

Before the host selects a game, the lobby is intentionally light:

1. **Players** (`RoomPlayersSection` without min/max or readiness) — who is
   here; inline display-name edit; no launch/capacity status or ready controls
2. **Choose a game** (host) — `GamePickerGrid` — or **Waiting** (non-host) —
   “Waiting for the host to choose a game…”
3. **Leave room**

There is no Game Information panel and no ready-check until setup begins.
Join capacity uses the shared lobby cap (`LOBBY_MAX_PLAYERS`) until a game is
selected.

### Room setup (game selected)

Prefer this order:

  1. **Game Information** (`GameInfo` / `GameSetupPanel`) — title, short
     description, How to Play, Configuration. No live room/player state and
     **no** static `min–max` player-range line (`showPlayerRange={false}`).
  2. **Players / Readiness** (`RoomPlayersSection`) — one cohesive section
  3. Host Start / Change Game (inside Players / Readiness controls)
  4. Leave room (room chrome)

### Players / Readiness (room setup)

In room setup, player list, occupancy guidance, and readiness are presented as
**one shared Players area** (`RoomPlayersSection`).

Hierarchy:

**Players → list → capacity/launch status → ready count → player's Ready action**

The Room Lobby does **not** show the game's static allowed player range (e.g.
`3–10`) in either Game Information or Players during setup. That range appears
on **home / create** (`GameInfo` with `showPlayerRange`). In setup, Players
communicates **current room launch/capacity state** only:

1. **Who is here** — names + you / host / ready|waiting (show disconnected only
   when relevant; do not repeat Connected on every row)
2. **Launch / capacity status** (prioritizes minimum-player readiness; uses
   registry `minPlayers` / `maxPlayers`):
   - Below minimum — `Need X more player(s)`
   - At/above minimum, below maximum — `Ready when everyone is ready`
   - At maximum — `Lobby full`
   - Over maximum (e.g. host selects a game whose `maxPlayers` is below the
     current seat count) — `Too many players (max N)` (Start blocked until
     seats fit; joining is still capped server-side for that game)
3. **Ready count** — `X / Y ready` (Y = seated players)
4. **Primary action** — `Ready` / `Not Ready` (plus host Start Game / Change Game)

Do **not** show a `current / max` occupancy line in Players — the player list
already shows who is present, and `current / max` misleadingly elevates the
maximum over the launch threshold.

| Concept | Meaning |
|---------|---------|
| `minPlayers` | Launch threshold — enough seats to start (drives “Need X more”) |
| `maxPlayers` | Room capacity — join limit (enforced server-side; “Lobby full”) |
| Ready count | Unanimous ready-check among seated players |

Do **not** add a separate `Ready` section heading — the action button already
communicates the player's readiness control.

| Element | Presentation |
|---------|----------------|
| Player list | Name (+ inline edit for you) · you / host / Ready|Waiting; host-only `⋮` → **Remove player** on others |
| Launch / capacity | Status under the list (`Need…` / `Ready when…` / `Lobby full` / `Too many…`) |
| Ready count | Status line only (`1 / 2 ready`) |
| Controls | Ready / Not Ready; host Start Game + Change Game |

Display-name editing in the Room Lobby is an **inline edit action** (pencil)
adjacent to the current player's name — not a separate Display name form at
the bottom of the section.

**Remove player** (host-only, room infrastructure): a compact `⋮` overflow on
other players’ rows (not on yourself; not visible to non-hosts). Label the
action **Remove player** (not Kick). Server authorizes host + other seated
target; removal follows the same pathway as Leave. The removed client receives
`left_room` with `reason: "removed"` and sees **You were removed from the
room.** (not Connection lost). Remaining players are not shown a removal
announcement. Removed players may rejoin if the room is still joinable. Do not
add large permanent Remove buttons.

Do not nest extra cards. Keep one coherent lobby status/action area.

**Static vs live player count**

- Home / create: static catalog metadata `3–10 players` (`GameInfo`
  `showPlayerRange`)
- Active room setup Game Information: no static range line
- Active room setup Players: minimum-player launch status (+ Lobby full /
  Too many at capacity edge cases) and ready messaging — never
  `current / max` or a restated `3–10` range

Maximum capacity is enforced **on the server** when joining (registry
`maxPlayers` while a game is selected; lobby cap when none is). The room
browser’s joinable flag is a hint only — rejection uses the normal join error
path.

The host control that cancels setup is labeled **Change Game** (not “Back”).

### Room Lobby typography

Room Lobby sections use one shared hierarchy — typography **and** spacing:

```text
SECTION HEADING
    ↓ clear vertical separation
PRIMARY CONTENT (value or list)
secondary status
```

| Role | Treatment | Examples |
|------|-----------|----------|
| Page / primary title | `--type-game` display (`.game-title`) | Game name (`Pictionary`) |
| Section heading | `.section-heading` inside `.section-stack` | Players, How to play, Configuration |
| Primary content | `.section-content` + `.section-body` (or list) | Configuration value, player list, game description |
| Secondary status | `.section-status` (`--type-meta`, quieter) | Launch/capacity (`Need…` / `Ready when…` / `Lobby full` / `Too many…`), ready count, optional config detail; You / Host / Ready / Waiting badges |

**Heading → content:** Section headings must read as labels for the section,
not as peers of the content. Use `.section-stack` so there is consistent
spacing between the heading and what follows. A single configuration value
(e.g. `Standard`, or any future option) uses the shared body/content
treatment — do not shrink it into metadata, and do not let it sit flush
against the heading so the pair reads as one line.

**Content → status:** Lobby status lines (seating requirement, ready count)
are secondary to the primary content (player list / config value).

Do **not** invent component-specific sizes that break this hierarchy.

Readiness **behavior** is unchanged (unanimous ready, host Start, no
auto-start, disconnect clears ready). Only presentation is shared.

After **GAME_OVER**, `RoomReadyControls` / `GameOverActions` still gates
**Play Again**; **Return to lobby** stays host-only without requiring
readiness.

Room browser: public rooms only; joinable when `LOBBY` and not full; polls
while open.

---

## Shared game shell

Game screens use a **page + stacked major panels** shell (exact sections vary
by game):

1. **Header** — game name; room code (on the page background)
2. **How to Play** — optional disclosure panel
3. **Current situation** — turn/phase, mission/objective; often emphasized
4. **Main game / table** — board, canvas, seats, tricks (game-owned center)
5. **Own hand / primary action** — emphasized when it is your turn
6. **History** — subordinate panel when useful
7. **Results / Review** — dominant panel when the game is over
8. **Room chrome** — players (inline name edit in lobby), Leave

### Game start / briefing

```text
GAME TITLE
[short objective / briefing]
[game-specific information]
[players / seats]
[primary start action or ready state]
```

Lobby setup already shows `GameInfo` (title, short description, How to Play
disclosure, Configuration — **without** the static player-range line). In-game
How to Play reuses the same structured content via the disclosure-only mode.

### Turn / phase status

Use `TurnStatus` (`.turn-status`):

- Title — e.g. “Your turn”, “George's turn”, “Drawing phase”
- Detail — short instruction or waiting line
- `data-active` — `you` | `other` | `idle` | `phase`
- Optional timer slot — `PhaseTimer` when the phase is timed

Do not change phase logic; only presentation.

### Player / seat representation

Footer lists use `GamePlayerList`:

```text
Player name
YOU / HOST / Ready|Waiting (when applicable) / turn|role tags
connected | disconnected
game-specific public tags
```

Board seats (Hanabi / Crew) remain game-owned. Never display hidden
information.

### Primary action area

`GameActionArea` (`.game-action-area`) places important controls under game
content with a consistent “Your action” label. Semantics and server validation
are unchanged.

### Error / invalid action feedback

`ActionFeedback` (`.action-feedback`, `role="alert"`) presents server `error`
messages. No browser alerts. Validation stays server-authoritative.

### Connection / reconnection / room-exit status

**Global status banners** communicate application, room, and connection state
and are visually **outside** the tabletop/game content hierarchy.

Render `GlobalStatusBanner` once at the **application shell** (above brand /
page header / game content):

```text
[ Global Status Banner ]
[ Brand / page header ]
[ Normal page/game content ]
```

Do **not** present room/connection status as a normal game `SectionPanel`,
tabletop card, or in-page Home content block.

| Event | Banner copy |
|-------|-------------|
| Connection problem | Connection lost |
| Socket establishing | Connecting… |
| Voluntary Leave (`reason: "left"`) | You left the room. |
| Host removal (`reason: "removed"`) | You were removed from the room. / The host removed you from this room. |

**Connected** is hidden (no persistent healthy-state banner).

Banners are **dismissible** client-side notifications: a compact close control
(accessible name **Dismiss notification**) hides the current banner without
changing connection, room membership, or protocol state. Dismissal lasts until
a **new/different** status appears (or the status clears and later occurs
again). Do not invent per-status dismissal systems.

Do **not** use “kicked” in the UI. Host removal is **not** announced to the
remaining players — they only see the updated player list.

Reconnect protocol is unchanged (token + `reconnect` on next open).

### Waiting / loading language

Prefer shared wording via `WaitingStatus` / status copy:

- Waiting for players…
- Waiting for {name}…
- Waiting for everyone to ready…
- Waiting for the host to choose a game…
- Connecting… / Connection lost / room-exit notices (via `GlobalStatusBanner`)

### How to Play / Game information

Game metadata and How to Play content are **structured data** presented through
the shared `GameInfo` component. Individual games provide the content (catalog
short description + `uxMeta` how-to fields); the platform owns the presentation.
Do not paste Markdown or duplicate the short description inside How to Play.

Distinction:

| Layer | Role | Source |
|-------|------|--------|
| **Short description** | Concise product blurb (home cards, setup header) | Registry / catalog |
| **How to Play** | Expanded Objective / Turn / End (disclosure) | `uxMeta.gameHowToPlay` |
| **Configuration** | Separate from How to Play; `Standard` when no options | Setup fields (currently empty → Standard) |

Do not place **room** settings (visibility, password) inside game Configuration.
Room visibility belongs in the Room section on create (`RoomVisibilityFields`).

Player range:

- **Static** (`3–10 players`) — game metadata on **home / create** via
  `GameInfo` (`showPlayerRange`)
- **Lobby setup Game Information** — does **not** show the static range
- **Lobby Players** — minimum-player launch status
  (`Need…` / `Ready when everyone is ready` / `Lobby full` / `Too many
  players (max N)` when over capacity) plus `X / Y ready` — not a
  `current / max` indicator and never a restated `min–max` range

In-game surfaces use the lightweight How to Play disclosure only
(`HowToPlay` → `GameInfo` with `showHowToPlay`). Setup uses Game Information
+ Players / Readiness without becoming a wall of text.

---

## In-game History

- Collapsible by default (`<details class="{game}-history">`)
- Compact, subdued typography (`--type-meta` lists)
- Chronological public information only — never leak secrets during play
- Each game chooses the right representation; a generic History widget is not
  required if another form communicates better

See [`shared-game-architecture.md`](./shared-game-architecture.md) and each
`games/*.md`.

---

## End-of-game Results / Review

Standardize the **presentation** of end-of-game results across games without
forcing identical scoring rules or inventing scores.

### Shared results shell

Use `GameResultsShell` (`.game-results`) with this hierarchy:

1. **Heading** — e.g. “Game complete” or “Mission complete”
2. **Outcome** — game-specific result line(s)
3. **Scores** (optional) — shared scoreboard rows when the game has meaningful
   scores; omit when it does not
4. **Review** — game-specific retrospective (chains, gallery, hands, votes, …)
5. **Footer** — ready-check + Play Again / Return to Lobby

Unify: placement, `Scores` heading treatment, name/value rows, highlight for
winners/team score, typography, spacing, and panel treatment
(`.game-results__*`).

### Scoring rules stay game-owned

- Do **not** invent numeric scores for games that do not already have them
- Do **not** change how modules calculate outcomes
- Hanabi exposes its existing team score via the shared scoreboard
- Fake Artist / Telestrations / Pictionary use outcome + review without a
  forced scoreboard
- The Crew uses mission success/failure (no artificial points)

History during play remains separate and subordinate; Review remains the
retrospective body inside the shared shell.

---

## Optional timers

Timers are **optional and game-specific**. When a game uses one:

- Integrate into the existing phase / turn banner (not a floating unrelated UI)
- Countdown readout such as `0:42` (shared `PhaseTimer` chip)
- Visual urgency: **normal → warning → critical**
  (defaults: warning ≤10s, critical ≤5s remaining)
- Same typography, spacing, badge/chip treatment, and positioning across games
  (`.phase-status` + `.phase-timer`)
- Disappear when the current phase is not timed (`endsAt` absent)
- Readable on desktop and phone

**Authority:** server publishes `endsAt` (epoch ms) on that game’s public state;
client renders remaining time for display only; client never expires the phase.
RoomManager schedules a generic one-shot from `getTimerDeadline()` and calls
`onTimer()` — no game-specific timer branches.

### Current Standard policy

| Game | Timed? | Standard duration(s) |
|------|--------|----------------------|
| Fake Artist | Drawing turns | 20s per stroke turn |
| Telestrations | Drawing / guessing rounds | 60s draw · 35s guess |
| Pictionary | Drawing/guessing round | 90s per drawer |
| Hanabi | No | — |
| The Crew | No | — |

No user-configurable timer settings or variants. See per-game docs for expiry
behavior and rationale.

Presentational contract:

```ts
type PhaseTimerProps = {
  endsAt: number | null | undefined;
  warningAtMsRemaining?: number;
  criticalAtMsRemaining?: number;
};
```

Implementation: `client/src/games/PhaseTimer.tsx`.

---

## Responsive behavior

- Home picker collapses to one column on narrow widths
- Major section panels **stack vertically** on narrow/mobile (`.game-stack`);
  do not create horizontal overflow to preserve desktop arrangements
- Panels and boards should remain usable on phone (readable type, tappable
  controls ≥ ~44px, no reliance on hover-only affordances)
- Drawing canvas and card fans should not overflow unreadably; scroll within
  review galleries when content is tall
- Primary action remains easy to find (emphasized panel + `GameActionArea`)
- Conceptual mobile order:

```text
GAME / MAIN CONTENT
PLAYERS / CURRENT INFORMATION
HISTORY / SECONDARY INFORMATION
PRIMARY ACTIONS
```

Desktop may use multiple columns inside a panel; the **stack of panels**
remains the shared outer grammar.

---

## Accessibility conventions

- Do not communicate important state through color alone (chips include text:
  Ready/Waiting, connected/disconnected; timer urgency also changes label
  context via countdown)
- Visible `:focus-visible` on buttons, inputs, summaries
- Sufficient text contrast via existing tokens
- Comfortable touch targets (`min-height: 44px` on primary controls/inputs)
- Readable minimum text via type scale (`--type-meta` floor for secondary)
- `prefers-reduced-motion: reduce` disables non-essential transitions
- Useful accessible names on timers (`aria-label` with “remaining”) and alerts
  (`role="alert"` on action feedback)

Do not redesign the visual system for a11y polish.

---

## Drawing

Shared `DrawingCanvas` for stroke-based games: normalized points, server-
authoritative stroke lists, disabled mode for review/spectator canvases.
Stroke colors may be derived from player id for distinction.

---

## Implementation notes (current)

- Prefer small shared components (`TurnStatus`, `GamePlayerList`,
  `GameActionArea`, `ActionFeedback`, `GlobalStatusBanner`, `HowToPlay`,
  `GameResultsShell`, `RoomReadyControls`) over duplicated chrome
- Room-code styling should use `.room-code` everywhere
- Drawing games and Hanabi/Crew share `TurnStatus`; Crew keeps green “you”
  accent via `.crew-turn-banner`
- CSS should keep type-scale tokens defined; avoid referencing undefined
  heading/body aliases

---

## Related documents

- [`architecture.md`](./architecture.md) — product and authority principles
- [`shared-game-architecture.md`](./shared-game-architecture.md) — history /
  review / timers as game-module concerns
- [`games/*.md`](./games/) — per-game UI specifics
