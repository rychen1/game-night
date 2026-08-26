# Hanabi

## Source of Truth

```text
architecture.md
        ↓
uiux.md / protocol.md / shared-game-architecture.md
        ↓
games/hanabi.md         ← you are here
        ↓
implementation
```

More specific documents override more general ones when they conflict.

Canonical code: `server/src/games/hanabi/`,
`client/src/games/hanabi/HanabiScreen.tsx`.
Protocol: `kind: "hanabi"`.

---

## Purpose

Cooperative fireworks: players see everyone else’s cards but not their own.
Give color/rank clues, play and discard carefully, complete stacks 1–5 in five
colors before fuses run out.

---

## Player count

**2–5** players.

---

## Core rules (as implemented)

- Standard-style deck: 5 colors × ranks `[1,1,1,2,2,3,3,4,4,5]` (50 cards)
- Hand size: 5 cards if ≤3 players, else 4
- Tokens: 8 clues, 3 fuses
- On your turn: play, discard (if clues &lt; 8), or clue another player (if
  clues &gt; 0); clue must touch ≥1 card
- Successful play of a 5 restores a clue; misplay → discard + lose a fuse
- When the deck empties, a final-turns countdown (`finalTurnsLeft`) begins at
  **`playerCount − 1`**
- Ends on perfect stacks, fuses exhausted, or final turns complete

### Final round (deck exhaustion)

When a play or discard draws the **last** card from the deck:

1. That player **completes the current turn** normally (including the draw).
2. The turn that emptied the deck **does not** consume a final-turn slot.
3. Each **other** player then receives **exactly one** additional turn.
4. There are **`N − 1`** such turns after the emptying turn (for `N` players).
5. The player who drew the final card **does not** take another turn before the
   game ends.

`finalTurnsLeft` is initialized to `N − 1` and decrements once per subsequent
completed turn until it reaches zero, then the game ends with `endReason:
"deck"`.

---

## Phases / state machine

```text
PLAYING → RESULTS
       ↘ ABORTED
```

| Phase | Meaning |
|-------|---------|
| `PLAYING` | Turns in progress |
| `RESULTS` | Score + end reason; faces revealed in private projection |
| `ABORTED` | Abort (`endReason: "aborted"`) |

---

## Actions

| Action | When legal |
|--------|------------|
| `give_clue` | Your turn, clues available, valid target/clue |
| `play_card` | Your turn |
| `discard_card` | Your turn and clue tokens not full |

---

## Public information

`phase`, `currentPlayerId`, `order`, `handSizes`, `stacks`, `discard`,
`clueTokens`, `fuseTokens`, `deckCount`, `finalTurnsLeft`, `log`.

On RESULTS: `endReason`, `score` (sum of stack heights, max 25).

`endReason`: `perfect` \| `fuses` \| `deck` \| `aborted`.

---

## Private information

`hands` for all seats as `HanabiCardView` (ids + knowledge). While
`PLAYING`, **own** card faces omit `color`/`rank`; others’ faces are visible.
On RESULTS/ABORTED, own faces are included in the projection.

`legalActions` for self.

---

## Game-specific UI

- Tabletop board: stacks, tokens, seats, hand fans, clue/play/discard controls
- Turn banner (`.hanabi-turn-banner`)
- `finalTurnsLeft` shown as countdown-of-turns (not a wall-clock timer)
- Classes: `.hanabi-history`, `.hanabi-review`

---

## Interaction model

Strict turn order; one action per turn.

---

## In-game history

`.hanabi-history`: public action log (clues/plays/discards). Never shows own
hidden faces during play.

---

## End-of-game Review

`.hanabi-review`: outcome/score, final stacks, full discard, final hands
(all faces), chronological log.

---

## Timers

**Convention:** **no timer by default** — deliberation is part of the game.  
**Current Standard settings:** no wall-clock timer.  
`finalTurnsLeft` is a rules counter, not a UX timer.

---

## Scoring / results

Score = sum of completed ranks on stacks. End reason distinguishes perfect /
fuse-out / deck / abort. RESULTS uses shared `GameResultsShell` with team
score in the Scores block + Review.

---

## Reconnection

Standard reconnect. Full state recoverable from projections.

---

## Settings

Standard only: `{ kind: "hanabi" }`. No setup fields.  
**Unresolved:** variants (e.g. hard mode, different token counts).

---

## Leave / abort

Any leave during the game → `ABORTED`.

---

## Implementation constraints

- Knowledge updates must stay server-side
- Never send own faces to the owner during `PLAYING`
- Deck/deal logic in `deck.ts`
