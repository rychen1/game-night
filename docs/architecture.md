# Game Night — Architecture

## Source of Truth

```text
architecture.md          ← you are here (highest-level principles)
        ↓
uiux.md / protocol.md / shared-game-architecture.md
        ↓
games/*.md
        ↓
implementation
```

More specific documents override more general ones when they conflict.
Protocol wire shapes and game rules are defined in `protocol.md` and
`games/*.md`, not here. Visual language lives in `uiux.md`. How games plug
into the platform lives in `shared-game-architecture.md`.

---

## What Game Night is

Game Night is a browser-based multiplayer platform for playing tabletop and
party games with friends over the same website.

Current games:

- Fake Artist
- Telestrations
- Pictionary
- Hanabi
- The Crew: Mission Deep Sea

The platform is designed so additional games can be added without rebuilding
rooms, networking, reconnection, or the shared client shell.

---

## Product vision

Build a **small, reusable multiplayer tabletop platform** on which new game
ideas can be rapidly prototyped and playtested.

Priorities:

1. Reliable multiplayer foundation (rooms, identity, reconnect, authority)
2. Modular games that own their own rules and hidden information
3. A consistent product UX that still lets each game keep its identity

Non-priorities for the prototype era: accounts, databases, matchmaking,
microservices, and heavy infrastructure.

---

## Client / server architecture

Two programs:

| Layer | Stack | Role |
|-------|--------|------|
| Client | React, TypeScript, Vite | Render UI, collect input, display public + own private state, send actions |
| Server | Node.js, TypeScript, Express (HTTP), `ws` (WebSockets) | Rooms, players, connections, game state, validation, secrets, results |

Clients talk to the server primarily over a persistent WebSocket while in a
session. Message shapes are specified in [`protocol.md`](./protocol.md).

Rooms and game state currently live in **server memory** only. That is
compatible with a **single-server** process. Multiple concurrent server
instances are not supported without sticky routing plus shared room state
(out of scope for the prototype).

---

## Deployment assumptions (current)

This section documents how the repo behaves today for production hosting.
It is not a full runbook.

### How programs are built and started

| Program | Dev | Production-shaped today |
|---------|-----|-------------------------|
| Client | `npm run dev` (Vite; proxies `/ws` → `ws://localhost:3001`) | `npm run build` → static files in `server/public` (Vite `outDir`; legacy `client/dist` still accepted) |
| Server | `npm run dev` (`tsx watch`) | `npm start` → `tsx src/server.ts` (TypeScript via `tsx`; `tsconfig` uses `noEmit`; **`tsx` is a production dependency** so start works with production installs) |

**Production same-origin:** after `client` build, the Node server serves the
built React app from `server/public` (static assets + SPA `index.html`
fallback) and keeps WebSocket on `/ws`. The server resolves that directory
from its **package root** (`server/`), not from `process.cwd()` alone, so
`cd server && npm start` on Render still finds assets produced by
`cd client && npm run build`. Local Vite UI development is unchanged (proxy
to the API only).

There is **no** root monorepo start script yet. A production deploy should
build the client, then start the server (optionally behind a TLS-terminating
reverse proxy on the same public origin).

### WebSocket URL and HTTPS / WSS

The client opens:

```text
(ws|wss)://{window.location.host}/ws
```

- Page on `https:` → `wss:` (correct for TLS sites)
- Page on `http:` → `ws:`

So **same-origin** hosting (or a reverse proxy that terminates TLS and forwards
`/ws`) works for production WSS. Splitting the SPA onto a different host than
the API **without** a matching proxy or configurable WS base URL will break
connections (the client always uses the page host).

The Node process listens with plain `http.createServer` (no in-process TLS).
Typical PaaS / reverse-proxy TLS termination is the expected production model.

Local Vite only: the `/ws` proxy to `localhost:3001` is **dev-only**
(`client/vite.config.ts`).

### Port binding

The server listens on **`process.env.PORT`** when set (typical PaaS inject
this), otherwise **`3001`** for local development. The Vite dev proxy still
targets `localhost:3001`.

### HTTP surface today

- `GET /health` → `{ ok: true }`
- WebSocket path `/ws` (unchanged)
- When a production client build exists (`server/public`, or legacy
  `client/dist`): static files from that directory, plus SPA fallback to
  `index.html` for other GET routes
- `cors()` enabled (wide open) — primarily relevant if HTTP APIs are called
  cross-origin; gameplay is WebSocket

### In-memory rooms vs single-server deploy

Compatible with **one** Node process:

- Rooms, players, reconnect tokens, and timers live in process memory
- Restart clears all rooms and invalidates reconnect tokens
- Horizontal scale-out needs shared state (not implemented)

See also long-term notes under [Long-term extensibility](#long-term-extensibility).

---

## Server-authoritative principle

The server is authoritative. The browser is a client.

Clients send requests and actions. The server validates them, updates state,
and returns the appropriate public and private views.

Clients must never be trusted to determine:

- game rules or legal actions
- whose turn it is
- scores, winners, or whether a game has ended
- hidden information (roles, secret words, cards others should not see)
- whether a timed phase has expired

```text
Player Browser
      |
      | action
      v
 WebSocket
      |
      v
Game Night Server
      |
      | validate → update → result
      |
      +---------> Public State (everyone in the room)
      |
      +---------> Private State (per player)
```

Hiding a field in the UI is not security. Unauthorized clients must never
receive secret data. See [`protocol.md`](./protocol.md) and
[`shared-game-architecture.md`](./shared-game-architecture.md).

---

## Rooms and players

A **room** is one multiplayer session. It has:

- a unique room code
- a host
- a player list
- visibility (`public` or `private`)
- optional setup for a selected game
- at most one running game instance

Room-level phases (distinct from in-game phases):

```text
LOBBY → GAME_RUNNING → GAME_OVER
              ↑               |
              └─ play_again ──┘
         return_to_lobby → LOBBY
```

A **player** has a stable server-assigned id, display name, connection flag,
host flag, **ready** flag, and a reconnect credential. Player identity survives
refresh via reconnect; it is not full authentication.

Public rooms appear in the room browser. Private rooms require a password and
do not appear in the public list.

### Share links (client)

Players in the lobby can copy a **share URL** or show a **QR code** for the
same link. This is a client-only affordance — the wire protocol is unchanged
and still joins via `join_room` with the 4-character room code.

**Canonical URL format:**

```text
https://{host}/?code=XXXX
```

`XXXX` is the existing room code (uppercase alphanumeric, 4 characters).
The client also accepts legacy-style path links `/join/XXXX`; both resolve to
the same join flow.

Opening a share link:

1. Loads the SPA home screen with the room code pre-filled
2. If the visitor already has a saved display name and the share link targets a
   **different** room than the saved reconnect session, the client **discards**
   the stale session and joins the shared room instead of reconnecting to the
   old one
3. If the share link targets the **same** room as the saved reconnect session,
   the client reconnects normally so the user does not create a duplicate seat
4. If there is no share link, normal reconnect behavior applies
5. If the visitor has a saved display name and no blocking reconnect session,
   the client sends `join_room` automatically
6. Private rooms still require the room password on the home join form — the
   share link does not embed passwords
7. After a successful join or reconnect, share query/path parameters are
   removed from the browser URL (`history.replaceState`) without leaving the
   session

QR codes encode the same canonical URL. No second room identity or invite
token is introduced.

Capacity and join rules are enforced on the server:

- **No game selected** — lobby uses `LOBBY_MAX_PLAYERS` (highest registered
  `maxPlayers`)
- **Game selected (setup)** — room capacity is that game’s registry
  `maxPlayers`; further joins are rejected with the normal room/join error
  (`This room is full`)
- **`minPlayers`** — launch threshold for Start (with unanimous ready); not a
  join floor
- **Selecting a game** does not kick excess players; if the room already has
  more seats than that game’s `maxPlayers`, Start stays blocked and the lobby
  shows `Too many players (max N)` until the count fits

Mid-game joins are not supported today. Client joinable hints (room browser)
must not be the only gate.

### Host authority vs player readiness

The **host** alone may select a game, change settings, cancel setup, initiate
**Start Game**, initiate **Play Again**, **Return to Lobby**, and **Remove
player** (another seated player — never themselves).

**Start Game** and **Play Again** also require **unanimous ready** among all
currently seated players (including the host). Ready is a per-player boolean on
room state, server-authoritative, and **generic infrastructure** — not
game-specific. Becoming ready never auto-starts; the host must still press
Start / Play Again after everyone is ready.

**Return to Lobby** remains host-only and does **not** require readiness.

**Remove player** is host-only room infrastructure (`remove_player`). It reuses
the same removal pathway as `leave_room` (seat cleared, reconnect token
invalidated, `onPlayerRemoved` during a game). Unauthorized attempts return a
generic `error` and do not mutate the room. The removed client receives
`left_room` with `reason: "removed"` and is shown a removal notice (not
Connection lost); remaining players only see the updated `room_state` — no
removal announcement. The removed player may join again if the room remains
joinable. This is not a ban, kick-history, or game-specific rule.

Disconnect clears that player’s ready flag. Leave / host remove removes them
from the readiness set. Reconnect restores the server’s ready value (typically
`false` after disconnect).

---

## Reconnection

Prototype reconnection (not accounts):

1. Server issues a `reconnectToken` with `welcome` / `room_created`
2. Client stores it locally
3. On reconnect, client sends `reconnect` with the token
4. Server restores player identity and connection status
5. Client receives current `room_state` and, when applicable, `private_state`

Socket disconnect marks the player disconnected but does **not** remove them
from the room or abort the game. Explicit `leave_room` does.

---

## High-level room / game lifecycle

```text
Home → create or join room
         ↓
       LOBBY (select game → setup → all Ready → host Start)
         ↓
    GAME_RUNNING (game module owns phases)
         ↓
     GAME_OVER (review → all Ready → host Play Again | host Return to lobby)
```

Host-only: select game, settings, cancel setup, Start Game, Play Again, Return
to Lobby, Remove player. Start Game and Play Again are rejected unless every
seated player is ready. See [`protocol.md`](./protocol.md) and
[`shared-game-architecture.md`](./shared-game-architecture.md).

---

## Modular game architecture

Games are independent modules behind a shared `Game` interface and registry.

**Infrastructure owns:** players, connections, room membership, host,
ready-check for Start / Play Again, broadcasting, reconnect, room browser,
parsing generic messages.

**Game modules own:** rules, phases, scoring, validation, public/private
projections, leave/abort behavior, optional timers, history/review data.

`RoomManager` and `WebSocketManager` must stay **game-agnostic**. They may
call registry helpers (`createGame`, `describeSetup`, …) but must not encode
Fake Artist / Hanabi / Crew (etc.) rules.

How to add a game, the `Game` contract, settings/setup, history/review, and
timers: [`shared-game-architecture.md`](./shared-game-architecture.md).

Per-game rules and UI: [`games/`](./games/).

---

## Infrastructure vs games

| Belongs in infrastructure | Belongs in a game module |
|---------------------------|---------------------------|
| Room codes, host, join/leave | Phases and legal transitions |
| WebSocket fan-out | Action validation and effects |
| Reconnect tokens | Secret generation and private views |
| Public/private room visibility | Scoring and end reasons |
| Generic `game_action` dispatch | Stroke/card/trick semantics |
| Lobby setup shell + registry metadata | Timer deadlines and expiry |
| Shared drawing canvas widget | Which strokes are authoritative |

---

## Development principles

1. **Server decides** whenever authority is in doubt.
2. **Games stay modular** — prefer new modules over editing room/network core.
3. **Keep infrastructure simple** — no Redis, Kubernetes, databases, accounts,
   or matchmaking until genuinely needed.
4. **Prefer understandable code** — avoid premature abstraction.
5. **Validate at the boundary** — every client message is untrusted.
6. **Build incrementally** — reliable rooms before polishing every game.

---

## Long-term extensibility

The intended growth path:

- Add games via registry + module + client screen + protocol union members
- Extend setup with registry `fields` / settings kinds when variants are needed
- Optionally add timers per game using the shared UX and `endsAt` pattern
- Persist rooms or accounts only when the prototype outgrows memory and tokens

The platform should remain one product: shared shell and conventions, distinct
game centers. See [`uiux.md`](./uiux.md).

---

## Related documents

| Document | Answers |
|----------|---------|
| [`uiux.md`](./uiux.md) | How the product looks and feels |
| [`protocol.md`](./protocol.md) | Exact WebSocket messages and state shapes |
| [`shared-game-architecture.md`](./shared-game-architecture.md) | How every game is built |
| [`games/*.md`](./games/) | Per-game rules and UI |
