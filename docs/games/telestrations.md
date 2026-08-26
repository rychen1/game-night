# Telestrations

## Source of Truth

```text
architecture.md
        ↓
uiux.md / protocol.md / shared-game-architecture.md
        ↓
games/telestrations.md  ← you are here
        ↓
implementation
```

More specific documents override more general ones when they conflict.

Canonical code: `server/src/games/telestrations/`,
`client/src/games/telestrations/TelestrationsScreen.tsx`.
Protocol: `kind: "telestrations"`.

---

## Purpose

Telephone-style draw-and-guess: each player starts a book with a secret prompt.
Books rotate; players alternately draw and guess. At the end, everyone reviews
the full chains.

---

## Official rulebook

- [The Op — Telestrations 8 Player (PDF)](https://cdn.shopify.com/s/files/1/0611/3958/3198/files/Compressed_Telestrations_8P_Rules_2025-1.pdf)

---

## Player count

**3–10** players.

---

## Core rules (as implemented)

1. Each player gets a prompt book (`totalRounds` = player count).
2. Simultaneous rounds: even rounds are `DRAWING`, odd are `GUESSING`
   (round index starts at 0).
3. Player works on the book at `(seatIndex - round) mod N`.
4. After all submit, round advances; when `round >= N`, enter `REVEAL`.
5. Book contents stay private to the current holder until reveal.

---

## Phases / state machine

```text
DRAWING ↔ GUESSING → REVEAL
                  ↘ ABORTED
```

| Phase | Meaning |
|-------|---------|
| `DRAWING` | Submit a drawing for current prompt/guess |
| `GUESSING` | Submit a text guess for current drawing |
| `REVEAL` | All books public — terminal success path |
| `ABORTED` | Terminal abort (no books published) |

Note: terminal success uses **`REVEAL`**, not `RESULTS`.

---

## Actions

| Action | When legal |
|--------|------------|
| `submit_drawing` | `DRAWING`, not yet submitted |
| `submit_guess` | `GUESSING`, not yet submitted; text length limited |

---

## Public information

`phase`, `round`, `totalRounds`, `playerOrder`, `submittedPlayerIds`.

`books` (full page chains) **only** in `REVEAL`.

---

## Private information

Per player: `task` (`draw` \| `guess` \| `reveal` \| `wait`), whether
`submitted`, `legalActions`, and either `promptText` / `guessText` (to draw)
or `strokes` (to guess). Never other players’ unfinished book pages.

---

## Game-specific UI

- Draw: local draft canvas + undo + submit
- Guess: read-only canvas + guess form
- Waiting copy when already submitted
- Classes: `.telestrations-history`, `.telestrations-review`

---

## Interaction model

Simultaneous submit-per-round (not a single shared turn order for drawing).

---

## In-game history

`.telestrations-history`: round/phase and per-player submitted vs waiting.
**No book contents.**

---

## End-of-game Review

`.telestrations-review`: centerpiece telephone chains — each book as
prompt → drawing → guess → … with author labels and canvases/text.
On `ABORTED`, no gallery (plain abort message + host controls).

---

## Timers

**Timed phases:** `DRAWING` and `GUESSING` (each simultaneous round).

**Standard durations:**

| Phase | Duration | Rationale |
|-------|----------|-----------|
| `DRAWING` | **60 seconds** | Full freehand drawing for a prompt/guess — longer than a Fake Artist stroke |
| `GUESSING` | **35 seconds** | Read a drawing and type a short guess — shorter than drawing |

**On expiry (server):** For every player who has not submitted, auto-complete
with an empty drawing or guess text `"(timed out)"`, then run the existing
`advanceIfReady` path (all submitted → next round or `REVEAL`).

**Authority:** `endsAt` on public state during timed phases. Client display only.

**Reconnect:** `endsAt` in `room_state`; client recomputes remaining time.

---

## Scoring / results

No scores or winners — the reveal is the payoff. REVEAL uses shared
`GameResultsShell` (outcome + Review of books; no Scores block).

---

## Reconnection

Standard reconnect. Draft strokes exist only on the client until submit;
refresh loses unsaved draft (**known prototype limitation**). Active phase
`endsAt` is restored from `room_state`.

---

## Settings

Standard only: `{ kind: "telestrations" }`. No setup fields.

---

## Leave / abort

Any player leave during the game → immediate `ABORTED` (no partial reveal).

---

## Implementation constraints

- Prompt list on server (`prompts.ts`); may wrap if player count exceeds pool
- Do not publish `books` before `REVEAL`
- Keep shared stroke representation with other drawing games
