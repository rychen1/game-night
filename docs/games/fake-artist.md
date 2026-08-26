# Fake Artist

## Source of Truth

```text
architecture.md
        ↓
uiux.md / protocol.md / shared-game-architecture.md
        ↓
games/fake-artist.md    ← you are here
        ↓
implementation
```

More specific documents override more general ones when they conflict.

Canonical code: `server/src/games/fakeArtist/`,
`client/src/games/fakeArtist/FakeArtistScreen.tsx`.
Protocol: `kind: "fakeArtist"`.

---

## Purpose

One player is the Fake Artist and knows only the category. Everyone else knows
the secret title. Players take turns adding one stroke to a shared drawing,
then vote for who they think the Fake Artist is. If correctly accused, the
Fake Artist may still win by guessing the title.

---

## Official rulebook

- [Oink Games — A Fake Artist Goes to New York (PDF)](https://cdn.1j1ju.com/medias/c0/75/df-a-fake-artist-goes-to-new-york-rulebook.pdf)

---

## Player count

**3–10** players.

---

## Core rules (as implemented)

1. Server picks a random Fake Artist and a category/title prompt.
2. Category is **public**. Title is private to artists only.
3. Drawing: two full passes over the turn order (`round` 1–2). Current player
   submits one stroke per turn.
4. Voting: each player votes for exactly one other player.
5. If a unique plurality correctly names the Fake Artist → **GUESS** phase for
   the Fake Artist; otherwise Fake Artist wins immediately. (Plurality = most
   votes; ties for the lead do not count as unique.)
6. Guess: correct title → artists win; incorrect → Fake Artist wins.

Stroke points are normalized roughly to `[0,1]` with a per-stroke point cap.

---

## Phases / state machine

```text
DRAWING → VOTING → GUESS? → RESULTS
                 ↘ RESULTS (Fake Artist already wins)
Any leave/abort path → ABORTED
```

| Phase | Meaning |
|-------|---------|
| `DRAWING` | Timed turns for strokes; `currentPlayerId` set |
| `VOTING` | Collect votes; `votedPlayerIds` public |
| `GUESS` | Accused Fake Artist guesses the title |
| `RESULTS` | Reveal word, Fake Artist, votes, winner |
| `ABORTED` | Terminal abort |

---

## Actions

| Action | When legal |
|--------|------------|
| `submit_stroke` | `DRAWING` and you are `currentPlayerId` |
| `vote` | `VOTING`, not yet voted, cannot self-vote |
| `guess_word` | `GUESS` and you are the Fake Artist |

---

## Public information

Always (while running): `phase`, `category`, `turnOrder`, `currentPlayerId`
(null outside drawing), `round`, `strokes`, `votedPlayerIds`.

On `RESULTS` / `ABORTED`: `fakeArtistId`, `word`, `votes[]`, `winner`
(`artists` \| `fakeArtist` \| `aborted`).

---

## Private information

| Field | Who sees it |
|-------|-------------|
| `role` | Self (`artist` \| `fakeArtist`) |
| `category` | Self (also public) |
| `word` | Artists only — **never** the Fake Artist during play |
| `legalActions` | Self |

---

## Game-specific UI

- Shared drawing canvas (live strokes)
- Status copy for whose turn / voting / guessing
- Vote button row; guess form for Fake Artist
- Classes: `.fake-artist-history`, `.fake-artist-review`

---

## Interaction model

Turn-based single stroke → simultaneous vote → optional Fake Artist text guess.

---

## In-game history

`.fake-artist-history`: chronological stroke authors; during voting/guess,
who has voted vs waiting (**not** vote targets); guess-phase note.

---

## End-of-game Review

`.fake-artist-review`: outcome, revealed title and Fake Artist, completed
drawing, full accusations, public timeline (strokes → votes → reveal).

---

## Timers

**Timed phase:** `DRAWING` only — one timer per stroke turn (resets when the
turn advances after a stroke or a timeout skip).

**Standard duration:** **20 seconds** per turn.

**Rationale:** Each turn is a single stroke, not a full drawing. A short window
keeps the canvas moving across two full passes without rushing freehand detail.

**On expiry (server):** Advance `turnIndex` as if the turn completed without a
stroke; if the queue is exhausted, enter `VOTING` (same transition as after the
final stroke). Voting and guess phases are untimed.

**Authority:** `endsAt` on public state while drawing; `getTimerDeadline` /
`onTimer` on the module. Client `PhaseTimer` display only.

**Reconnect:** Restores `endsAt` via `room_state`; remaining time is
`endsAt - now`.

---

## Scoring / results

Winner flag only (`artists` / `fakeArtist` / `aborted`). No numeric score.
RESULTS uses shared `GameResultsShell` (outcome + Review; no Scores block).

---

## Reconnection

Standard room reconnect. Disconnect does not abort. State fully recoverable
from public + private projections, including active `endsAt` for the drawing
timer.

---

## Settings

Standard only: `{ kind: "fakeArtist" }`. No setup fields.

---

## Leave / abort

- Fake Artist leaves, or fewer than 3 players remain → `ABORTED`
- Otherwise non-Fake leave: prune turn order / queue; may force voting or
  vote resolution if needed

---

## Implementation constraints

- Prompt pool: small categorized word list on server (`words.ts`)
- Do not leak `word` or vote targets before RESULTS
- `guess_word` outcome: correct title → `winner: "artists"`; incorrect →
  `winner: "fakeArtist"`
- Shared canvas for review as well as play
