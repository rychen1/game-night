# Pictionary

## Source of Truth

```text
architecture.md
        ↓
uiux.md / protocol.md / shared-game-architecture.md
        ↓
games/pictionary.md     ← you are here
        ↓
implementation
```

More specific documents override more general ones when they conflict.

Canonical code: `server/src/games/pictionary/`,
`client/src/games/pictionary/PictionaryScreen.tsx`.
Protocol: `kind: "pictionary"`.

---

## Purpose

One player draws a secret word; others guess in chat-style guesses. Drawers
rotate until each player has drawn once (queue length = player count).

---

## Official rulebook

- [Mattel — Pictionary (PDF)](https://service.mattel.com/instruction_sheets/DKD47-Eng.pdf)

---

## Player count

**3–10** players.

---

## Core rules (as implemented)

1. Shuffle a drawer queue; deal one word per drawer (avoid recent words).
2. Drawer may submit strokes; non-drawers submit guesses (public text).
3. First correct guess completes the round: archive strokes + guesses into
   `history`, publish `lastRound`, advance drawer or finish.
4. When the queue is empty → `RESULTS`.

Public field `solved` exists but is currently always `false` (unused).

---

## Phases / state machine

```text
DRAWING → DRAWING (next drawer) → … → RESULTS
                                   ↘ ABORTED
```

| Phase | Meaning |
|-------|---------|
| `DRAWING` | Active drawer + live strokes/guesses |
| `RESULTS` | Full archived gallery available |
| `ABORTED` | Terminal abort |

---

## Actions

| Action | When legal |
|--------|------------|
| `submit_stroke` | `DRAWING` and you are the drawer |
| `submit_guess` | `DRAWING` and you are not the drawer |

---

## Public information

`phase`, `drawerId`, `round`, `totalRounds`, `strokes`, `guesses` (including
incorrect text and `correct` flags), optional `lastRound`.

`history` (per-round drawer, word, solver, strokes, guesses) **only** in
`RESULTS`.

---

## Private information

`role` (`drawer` \| `guesser`), `legalActions`, and `word` **only for the
current drawer** during `DRAWING`.

---

## Game-specific UI

- Live canvas + guess list + guess form
- Last-round one-liner when present
- Classes: `.pictionary-history`, `.pictionary-review`

---

## Interaction model

Single drawer strokes continuously; guessers submit text until correct.

---

## In-game history

`.pictionary-history`: current round meta (drawer, stroke count), last round
summary, live guesses. Past archived drawings are **not** shown until RESULTS.

---

## End-of-game Review

`.pictionary-review`: gallery of archived rounds — word, drawer, solver,
canvas, guess list.

---

## Timers

**Timed phase:** `DRAWING` — one timer for the active drawer’s full
draw-and-guess window.

**Standard duration:** **90 seconds** per drawer.

**Rationale:** Classic party-game pacing: enough time for strokes and several
guesses, without stalling the rotation through every player.

**On expiry (server):** Treat as an unsolved round — clear strokes/guesses,
consume that drawer’s slot, start the next drawer (or `RESULTS` if none remain).
Solved rounds still end early on a correct guess (timer resets for the next
drawer).

**Authority:** `endsAt` on public state while drawing. Client display only.

**Reconnect:** `endsAt` in `room_state`; client recomputes remaining time.

---

## Scoring / results

No point totals. Review is the record of who drew/solved each word. RESULTS
uses shared `GameResultsShell` (outcome + Review; no Scores block).

---

## Reconnection

Standard reconnect. Live strokes are server-authoritative (survive refresh).
Active round `endsAt` is restored from `room_state`.

---

## Settings

Standard only: `{ kind: "pictionary" }`. No setup fields.

---

## Leave / abort

- Fewer than 3 players → `ABORTED`
- Drawer leaves with drawers remaining → skip to next word/drawer
- Drawer leaves with none remaining → `RESULTS`
- Non-drawer leave: play continues (if still ≥3)

---

## Implementation constraints

- Round archive must clone strokes/guesses before clearing live state
- Guess text is public during play — intentional for this party style
- Word list on server (`words.ts`)
