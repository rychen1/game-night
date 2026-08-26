# The Crew: Mission Deep Sea

## Source of Truth

```text
architecture.md
        ↓
uiux.md / protocol.md / shared-game-architecture.md
        ↓
games/the-crew.md       ← you are here
        ↓
implementation
```

More specific documents override more general ones when they conflict.

Canonical code: `server/src/games/crew/`,
`client/src/games/crew/CrewScreen.tsx`.
Protocol: `kind: "crew"`.

---

## Purpose

Cooperative trick-taking with limited communication. The crew receives a
mission with tasks, may communicate once per player, then plays tricks to
satisfy (and avoid failing) task conditions.

This is a **prototype-friendly** Mission Deep Sea–inspired module, not a full
official campaign ruleset.

---

## Official rulebook

- [Thames & Kosmos — The Crew: Mission Deep Sea (PDF)](https://www.thamesandkosmos.co.uk/wp-content/uploads/2021/02/691869_Crew_Deep-Sea_Manual.pdf)

---

## Player count

**2–5** players.

---

## Core rules (as implemented)

1. Deal from a 40-card deck (suits red/blue/green/yellow ranks 1–9; submarine
   trump 1–4). Official Deep Sea sizes: 3p → 14/13/13; 4p → 10 each; 5p → 8
   each (all 40 cards dealt). 2p uses 10 each with 20 undealt (no Tonoja).
2. Pick a random starter mission; assign tasks; mark outcomes for undealt
   target cards where applicable (`player_wins_card` on an undealt card →
   `failed`; `player_must_not_win` on an undealt card → `satisfied`).
3. **TASKS** phase: review briefing; any seated player may `crew_begin_mission`.
   If **every** task is already terminal (no `pending` remain), the mission
   may end immediately in **RESULTS** (all `satisfied` → success; any
   `failed` → failure). If at least one task is still `pending`, play
   proceeds to **PLAYING** even when other tasks are already `failed` or
   `satisfied`.
4. **PLAYING**: follow-suit tricks; submarine is trump; winner leads next.
5. Communication: at most **one** per player per mission, only during
   `PLAYING` and **before a trick begins**, using legal `communicableOptions`
   (highest/lowest/only × color/rank) about a card still in hand. Submarine
   cards cannot be communicated.
6. After tricks, tasks update to `satisfied` / `failed` / `pending`. All
   satisfied → success; any failed → failure.

Task kinds in starter missions include `player_wins_card` and
`player_must_not_win` (see `missions.ts`).

---

## Phases / state machine

```text
TASKS → PLAYING → RESULTS
               ↘ ABORTED
     ↘ RESULTS (immediate, if all tasks terminal — no pending)
```

| Phase | Meaning |
|-------|---------|
| `TASKS` | Briefing; begin mission |
| `PLAYING` | Tricks + optional communications |
| `RESULTS` | Mission outcome; `finalHands` revealed |
| `ABORTED` | Abort |

---

## Actions

| Action | When legal |
|--------|------------|
| `crew_begin_mission` | `TASKS` (any seated player) |
| `crew_play_card` | `PLAYING`, your turn, card playable |
| `crew_communicate` | `PLAYING`, not yet communicated, legal option |

---

## Public information

`phase`, `mission`, `tasks` (id, description, status), `order`,
`currentPlayerId`, `trumpColor` (`submarine`), `handSizes`, `currentTrick`,
`completedTricks`, `communications`.

On RESULTS/ABORTED: `finalHands` (remaining cards per seat), `endReason`
(`success` \| `failure` \| `aborted`).

Opponent hand **faces** are not public during play.

---

## Private information

Own `hand` (full faces), `legalActions`, optional `playableCardIds`, optional
`communicableOptions`. Never other players’ hands in private state.

---

## Game-specific UI

- Mission chrome, task list, seats with hand sizes + communication markers
- Trick row; own hand with selection
- Communicate controls when legal
- Turn / briefing banners (`.crew-turn-banner`, briefing block in TASKS)
- Classes: `.crew-history`, `.crew-review`

---

## Interaction model

Briefing → begin → trick-taking with optional one-shot communications.

---

## In-game history

`.crew-history` during `PLAYING`: public communications + completed tricks
(winner + plays). No opponent leftover hand faces.

---

## End-of-game Review

`.crew-review`: mission result, task statuses, communications, all tricks,
final remaining hands via `finalHands`.

---

## Timers

**Convention:** **no timer by default** — communication and planning are part
of the game.  
**Current Standard settings:** no timer implemented.

---

## Scoring / results

Mission `endReason` only (success / failure / aborted). No numeric score.
RESULTS uses shared `GameResultsShell` (mission outcome + Mission summary;
no Scores block).

---

## Reconnection

Standard reconnect. Play state is server-authoritative.

---

## Settings

Standard only: `{ kind: "crew" }`. No setup fields.  
**Unresolved:** mission selection UI, difficulty progression, fuller official
communication rules / commander radio token, larger mission catalog.

---

## Leave / abort

Any leave during the game → `ABORTED`.

---

## Implementation constraints

- Populate `finalHands` only in RESULTS/ABORTED
- Communication restricted to `PLAYING` (not TASKS)
- Undealt-card task outcomes must be evaluated at setup so impossible tasks
  do not soft-lock
- Starter missions only (`missions.ts`) — not a full campaign
- Keep RoomManager free of Crew-specific trick logic
