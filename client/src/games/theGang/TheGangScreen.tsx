import type {
  GameAction,
  GangCard,
  GangChipColor,
  GangHeistResult,
  GangPrivateState,
  GangPublicState,
  PublicPlayer,
  RoomStatePayload,
} from "../../network/messages.ts";
import { ActionFeedback } from "../../components/ActionFeedback.tsx";
import { GameOverActions } from "../../components/GameOverActions.tsx";
import { GameResultsShell } from "../../components/GameResultsShell.tsx";
import { HowToPlay } from "../../components/HowToPlay.tsx";
import { SectionPanel } from "../../components/SectionPanel.tsx";
import { WaitingStatus } from "../../components/WaitingStatus.tsx";
import {
  cardLabel,
  CHIP_COLOR_LABEL,
  CHIP_COLORS,
  isRedSuit,
  PHASE_LABEL,
  rankLabel,
  suitSymbol,
} from "./cards.ts";
import { gangModeLabel } from "./setup.ts";
import {
  InformantCardNotice,
  GetawayDriverPanel,
  ShowdownGatePanel,
  SpecialistSetupPanel,
} from "./TheGangModifierPanels.tsx";

type TheGangScreenProps = {
  playerId: string;
  room: RoomStatePayload;
  game: GangPublicState;
  privateState: GangPrivateState | null;
  error: string | null;
  onLeaveRoom: () => void;
  onReturnToLobby: () => void;
  onPlayAgain: () => void;
  onSetReady: (ready: boolean) => void;
  onGameAction: (action: GameAction) => void;
};

function playerName(players: PublicPlayer[], id: string): string {
  return players.find((player) => player.id === id)?.name ?? "Unknown";
}

function holderForStar(game: GangPublicState, star: number): string | null {
  return game.chipHeld.find((entry) => entry.star === star)?.playerId ?? null;
}

function strengthHeldBy(game: GangPublicState, targetId: string): number | null {
  return game.chipHeld.find((entry) => entry.playerId === targetId)?.star ?? null;
}

function PlayingCard({ card }: { card: GangCard }) {
  if (card.jackSpecialist) {
    return (
      <span className="gang-card" aria-label="Jack specialist">
        <span className="gang-card__rank">J*</span>
      </span>
    );
  }
  const red = isRedSuit(card.suit!);
  return (
    <span
      className={`gang-card${red ? " gang-card--red" : ""}`}
      aria-label={cardLabel(card)}
    >
      <span className="gang-card__rank">{rankLabel(card.rank)}</span>
      <span className="gang-card__suit">{suitSymbol(card.suit!)}</span>
    </span>
  );
}

function StrengthToken({
  star,
  color,
  small,
}: {
  star: number;
  color: GangChipColor;
  small?: boolean;
}) {
  return (
    <span
      className={`gang-chip gang-chip--${color}${small ? " gang-chip--small" : ""}`}
      aria-label={`Strength ${star}`}
    >
      {"★".repeat(star)}
    </span>
  );
}

function starForPlayerAtColor(
  game: GangPublicState,
  playerId: string,
  color: GangChipColor,
  isChipPhase: boolean,
): number | null {
  const snapshot = game.chipHistory.find((entry) => entry.color === color);
  if (snapshot) {
    const held = snapshot.held.find((entry) => entry.playerId === playerId);
    if (held) {
      return held.star;
    }
  }
  if (isChipPhase && color === game.chipColor) {
    return strengthHeldBy(game, playerId);
  }
  return null;
}

function PlayerChipRows({
  game,
  players,
  playerId,
  isChipPhase,
}: {
  game: GangPublicState;
  players: PublicPlayer[];
  playerId: string;
  isChipPhase: boolean;
}) {
  return (
    <div className="gang-chip-rows" aria-label="Player strength by street">
      <h3 className="gang-chip-rows__title">Player chips</h3>
      <div className="gang-chip-rows__grid" role="table">
        <div className="gang-chip-rows__header" role="row">
          <span className="gang-chip-rows__name-col" role="columnheader">
            Player
          </span>
          {CHIP_COLORS.map((color) => (
            <span
              key={color}
              className={`gang-chip-rows__header-cell${
                isChipPhase && color === game.chipColor
                  ? " gang-chip-rows__header-cell--current"
                  : ""
              }`}
              role="columnheader"
            >
              {CHIP_COLOR_LABEL[color]}
            </span>
          ))}
        </div>
        {players.map((player) => (
          <div
            key={player.id}
            className={`gang-chip-rows__row${
              player.id === playerId ? " gang-chip-rows__row--mine" : ""
            }`}
            role="row"
          >
            <span className="gang-chip-rows__name" role="rowheader">
              {player.name}
              {player.id === playerId ? " (you)" : ""}
            </span>
            {CHIP_COLORS.map((color) => {
              const star = starForPlayerAtColor(game, player.id, color, isChipPhase);
              const isCurrentStreet = isChipPhase && color === game.chipColor;
              const isLocked =
                star !== null && isCurrentStreet && game.lockedStars.includes(star);

              return (
                <div
                  key={color}
                  className={`gang-chip-rows__cell${
                    isCurrentStreet ? " gang-chip-rows__cell--current" : ""
                  }`}
                  role="cell"
                >
                  {star !== null ? (
                    <span
                      className={isLocked ? "gang-chip-rows__token gang-chip-rows__token--locked" : "gang-chip-rows__token"}
                      title={isLocked ? "Locked position" : undefined}
                    >
                      <StrengthToken star={star} color={color} small />
                    </span>
                  ) : (
                    <span className="gang-chip-rows__empty" aria-hidden="true">
                      —
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function PositionToken({
  rank,
  color,
}: {
  rank: number;
  color: GangChipColor;
}) {
  return (
    <span
      className={`gang-position-token gang-position-token--${color}`}
      aria-hidden="true"
    >
      {rank}
    </span>
  );
}

function StrengthBoard({
  game,
  players,
  playerId,
  canClaim,
  canRelease,
  lockedStars,
  onGameAction,
}: {
  game: GangPublicState;
  players: PublicPlayer[];
  playerId: string;
  canClaim: boolean;
  canRelease: boolean;
  lockedStars: number[];
  onGameAction: (action: GameAction) => void;
}) {
  const stars = Array.from({ length: game.playerCount }, (_, index) => index + 1);

  return (
    <div className="gang-strength-board" role="list" aria-label="Strength positions">
      {stars.map((star) => {
        const holderId = holderForStar(game, star);
        const isMine = holderId === playerId;
        const isClaimed = holderId !== null;
        const isLocked = lockedStars.includes(star);
        const canReleaseMine = isMine && isClaimed && canRelease && !isLocked;
        const canSteal = canClaim && isClaimed && !isMine && !isLocked;
        const canClaimOpen = canClaim && !isClaimed;

        return (
          <div
            key={star}
            className={`gang-strength-slot${
              isClaimed ? " gang-strength-slot--claimed" : " gang-strength-slot--unclaimed"
            }${isMine ? " gang-strength-slot--mine" : ""}${
              isLocked ? " gang-strength-slot--locked" : ""
            }`}
            role="listitem"
          >
            {canClaimOpen || canSteal || canReleaseMine ? (
              <button
                type="button"
                className={`gang-strength-slot__claim${
                  canSteal ? " gang-strength-slot__claim--steal" : ""
                }${canReleaseMine ? " gang-strength-slot__claim--release" : ""}`}
                onClick={() => {
                  if (canReleaseMine) {
                    onGameAction({ type: "gang_release_strength" });
                    return;
                  }
                  onGameAction({ type: "gang_claim_strength", star });
                }}
                aria-label={
                  canReleaseMine
                    ? `Release strength ${star}`
                    : canSteal
                      ? `Claim strength ${star} from ${playerName(players, holderId!)}`
                      : `Claim strength ${star}`
                }
                title={
                  canReleaseMine
                    ? "Return this position to the center"
                    : canSteal
                      ? `Claim from ${playerName(players, holderId!)}`
                      : "Claim this position"
                }
              >
                <PositionToken rank={star} color={game.chipColor} />
                {canClaimOpen ? (
                  <span className="gang-strength-slot__hint">Claim</span>
                ) : canReleaseMine ? (
                  <span className="gang-strength-slot__hint">Release</span>
                ) : null}
              </button>
            ) : (
              <PositionToken rank={star} color={game.chipColor} />
            )}
            {isClaimed ? (
              <span className="gang-strength-slot__name">
                {playerName(players, holderId!)}
                {isMine ? " (you)" : ""}
              </span>
            ) : (
              <span className="gang-strength-slot__name gang-strength-slot__name--empty">
                Open
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActiveModifiers({
  modifiers,
}: {
  modifiers: GangPublicState["activeModifiers"];
}) {
  if (modifiers.length === 0) {
    return null;
  }

  return (
    <ul className="gang-modifiers" aria-label="Active modifiers">
      {modifiers.map((modifier) => (
        <li key={`${modifier.kind}-${modifier.id}`} className="gang-modifier">
          <span
            className={`gang-modifier__badge gang-modifier__badge--${modifier.kind}`}
          >
            {modifier.kind === "challenge" ? "Challenge" : "Specialist"}
            {modifier.permanent ? " (permanent)" : ""}
          </span>
          <strong className="gang-modifier__name">{modifier.name}</strong>
          <p className="gang-modifier__description">{modifier.description}</p>
        </li>
      ))}
    </ul>
  );
}

function HeistReview({
  heist,
  players,
}: {
  heist: GangHeistResult;
  players: PublicPlayer[];
}) {
  return (
    <article className="gang-review__heist">
      <h3 className="gang-review__heist-title">
        Heist {heist.heistNumber}{" "}
        {heist.success ? (
          <span className="gang-review__success">Vault opened</span>
        ) : (
          <span className="gang-review__fail">Alarm triggered</span>
        )}
      </h3>
      <ol className="gang-review__reveal-list">
        {[...heist.reveals]
          .sort((a, b) => a.star - b.star)
          .map((reveal) => (
            <li
              key={`${heist.heistNumber}-${reveal.playerId}`}
              className={
                reveal.rankingCorrect
                  ? "gang-review__reveal gang-review__reveal--correct"
                  : "gang-review__reveal gang-review__reveal--incorrect"
              }
            >
              <StrengthToken star={reveal.star} color="red" />
              <span className="gang-review__player">
                {playerName(players, reveal.playerId)}
              </span>
              <span className="gang-review__hand">{reveal.hand.label}</span>
              <span className="gang-review__cards">
                {reveal.hand.cards.map((card) => (
                  <PlayingCard key={`${card.rank}-${card.suit}`} card={card} />
                ))}
              </span>
            </li>
          ))}
      </ol>
    </article>
  );
}

export function TheGangScreen({
  playerId,
  room,
  game,
  privateState,
  error,
  onLeaveRoom,
  onReturnToLobby,
  onPlayAgain,
  onSetReady,
  onGameAction,
}: TheGangScreenProps) {
  const isHost = room.hostPlayerId === playerId;
  const isGameOver = game.phase === "RESULTS" || game.phase === "ABORTED";
  const isChipPhase =
    game.phase === "PREFLOP" ||
    game.phase === "FLOP" ||
    game.phase === "TURN" ||
    game.phase === "RIVER";
  const isModifierSetup = game.phase === "MODIFIER_SETUP";
  const isShowdownGate = game.phase === "SHOWDOWN_GATE";
  const legal = privateState?.legalActions ?? [];
  const myStrength = strengthHeldBy(game, playerId);
  const canClaim = legal.includes("gang_claim_strength");
  const canRelease = legal.includes("gang_release_strength");
  const canProceed = legal.includes("gang_proceed_street");
  const waitingPlayers = room.players.filter(
    (player) => strengthHeldBy(game, player.id) === null,
  );
  const allClaimed = isChipPhase && waitingPlayers.length === 0;
  const showChipRows =
    isChipPhase || isShowdownGate || (game.chipHistory.length > 0 && !isModifierSetup);

  return (
    <main className="page">
      <h1>The Gang</h1>
      <p className="lede">
        Room <span className="room-code">{room.roomCode}</span>
        {isGameOver
          ? game.phase === "RESULTS"
            ? game.endReason === "won"
              ? " — victory"
              : " — defeat"
            : " — aborted"
          : ` — heist ${game.heistNumber} (${gangModeLabel(game.mode)})`}
      </p>

      <div className="game-stack game-stack--wide">
        <SectionPanel aria-label="How to play">
          <HowToPlay gameId="theGang" />
        </SectionPanel>

        {!isGameOver ? (
          <>
            <SectionPanel aria-label="Score">
              <div className="gang-scoreboard">
                <div className="gang-scoreboard__track">
                  <span className="gang-scoreboard__label">Vaults</span>
                  <div className="gang-scoreboard__dots">
                    {[1, 2, 3].map((slot) => (
                      <span
                        key={`vault-${slot}`}
                        className={`gang-scoreboard__dot gang-scoreboard__dot--vault${
                          game.vaultsOpened >= slot ? " gang-scoreboard__dot--filled" : ""
                        }`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <span className="gang-scoreboard__count">{game.vaultsOpened}/3</span>
                </div>
                <div className="gang-scoreboard__track">
                  <span className="gang-scoreboard__label">Alarms</span>
                  <div className="gang-scoreboard__dots">
                    {Array.from({ length: game.alarmsToLose }, (_, index) => index + 1).map(
                      (slot) => (
                        <span
                          key={`alarm-${slot}`}
                          className={`gang-scoreboard__dot gang-scoreboard__dot--alarm${
                            game.alarms >= slot ? " gang-scoreboard__dot--filled" : ""
                          }`}
                          aria-hidden="true"
                        />
                      ),
                    )}
                  </div>
                  <span className="gang-scoreboard__count">
                    {game.alarms}/{game.alarmsToLose}
                  </span>
                </div>
              </div>
            </SectionPanel>

            {game.activeModifiers.length > 0 ? (
              <SectionPanel aria-label="Active modifiers">
                <h2 className="gang-section-title">Active cards</h2>
                <ActiveModifiers modifiers={game.activeModifiers} />
              </SectionPanel>
            ) : null}

            <InformantCardNotice privateState={privateState} />

            {game.musclePlayerId ? (
              <SectionPanel aria-label="Muscle specialist">
                <p className="status gang-muscle-notice">
                  <strong>Muscle:</strong>{" "}
                  {playerName(room.players, game.musclePlayerId)} wins ties against
                  hands of the same category at showdown.
                </p>
              </SectionPanel>
            ) : null}

            {game.getawayDriverDeclaration ? (
              <SectionPanel aria-label="Getaway Driver declaration">
                <p className="status">
                  <strong>Getaway Driver:</strong>{" "}
                  {playerName(room.players, game.getawayDriverDeclaration.playerId)}{" "}
                  declared {game.getawayDriverDeclaration.label}.
                </p>
              </SectionPanel>
            ) : null}

            {isModifierSetup ? (
              <SpecialistSetupPanel
                game={game}
                privateState={privateState}
                players={room.players}
                playerId={playerId}
                onGameAction={onGameAction}
              />
            ) : null}

            {isShowdownGate ? (
              <ShowdownGatePanel
                game={game}
                privateState={privateState}
                players={room.players}
                playerId={playerId}
                onGameAction={onGameAction}
              />
            ) : null}

            <SectionPanel aria-label="Your cards">
              <h2 className="gang-section-title">Your hole cards</h2>
              <div className="gang-card-row">
                {(privateState?.holeCards ?? []).map((card) => (
                  <PlayingCard key={`hole-${card.rank}-${card.suit}`} card={card} />
                ))}
              </div>
            </SectionPanel>

            <SectionPanel aria-label="Community cards">
              <h2 className="gang-section-title">Community</h2>
              <div className="gang-card-row">
                {game.communityCards.length === 0 ? (
                  <p className="status">No community cards yet.</p>
                ) : (
                  game.communityCards.map((card) => (
                    <PlayingCard
                      key={`comm-${card.rank}-${card.suit}`}
                      card={card}
                    />
                  ))
                )}
              </div>
            </SectionPanel>

            {showChipRows && !isChipPhase ? (
              <SectionPanel aria-label="Player chips">
                <PlayerChipRows
                  game={game}
                  players={room.players}
                  playerId={playerId}
                  isChipPhase={isChipPhase}
                />
              </SectionPanel>
            ) : null}

            {isChipPhase ? (
              <SectionPanel aria-label="Strength selection" emphasis>
                <h2 className="gang-section-title">
                  {PHASE_LABEL[game.phase]} — {CHIP_COLOR_LABEL[game.chipColor]} tokens
                </h2>
                <p className="status">
                  Positions run weakest (1) to strongest ({game.playerCount}), left to
                  right. Click a position to claim it or take it from another player.
                  Click your own position to return it to the center, or claim a new
                  one to switch. When everyone has claimed, anyone may proceed to the
                  next street.
                </p>

                <GetawayDriverPanel
                  game={game}
                  privateState={privateState}
                  players={room.players}
                  playerId={playerId}
                  onGameAction={onGameAction}
                />

                <h3 className="gang-strength-layout__heading">Positions</h3>
                <StrengthBoard
                  game={game}
                  players={room.players}
                  playerId={playerId}
                  canClaim={canClaim}
                  canRelease={canRelease}
                  lockedStars={game.lockedStars}
                  onGameAction={onGameAction}
                />

                {allClaimed ? (
                  <div className="gang-proceed">
                    <button
                      type="button"
                      className="gang-proceed__button"
                      disabled={!canProceed}
                      onClick={() => onGameAction({ type: "gang_proceed_street" })}
                    >
                      Proceed
                    </button>
                    <p className="gang-proceed__hint status">
                      Everyone has a position. Any player can proceed to the next street.
                    </p>
                  </div>
                ) : myStrength !== null && waitingPlayers.length > 0 ? (
                  <WaitingStatus
                    message={`Waiting for ${waitingPlayers
                      .map((player) => player.name)
                      .join(", ")} to claim a position.`}
                  />
                ) : null}
              </SectionPanel>
            ) : null}

            {isChipPhase ? (
              <SectionPanel aria-label="Player chips">
                <PlayerChipRows
                  game={game}
                  players={room.players}
                  playerId={playerId}
                  isChipPhase={isChipPhase}
                />
              </SectionPanel>
            ) : null}

            {game.chipHistory.length > 0 ? (
              <SectionPanel aria-label="Strength history">
                <details className="gang-history">
                  <summary>Strength history ({game.chipHistory.length})</summary>
                  <ul className="gang-history__list">
                    {game.chipHistory.map((snapshot) => (
                      <li key={snapshot.color}>
                        <strong>{CHIP_COLOR_LABEL[snapshot.color]}</strong>
                        {snapshot.held.map((entry) => (
                          <span key={entry.playerId} className="gang-history__entry">
                            {entry.star}★: {playerName(room.players, entry.playerId)}
                          </span>
                        ))}
                      </li>
                    ))}
                  </ul>
                </details>
              </SectionPanel>
            ) : null}

            {game.lastHeist ? (
              <SectionPanel aria-label="Last heist">
                <h2 className="gang-section-title">Last heist showdown</h2>
                <HeistReview heist={game.lastHeist} players={room.players} />
              </SectionPanel>
            ) : null}
          </>
        ) : null}

        {game.phase === "ABORTED" ? (
          <SectionPanel emphasis aria-label="Results">
            <GameResultsShell
              className="gang-review"
              heading="Game complete"
              outcome={<p>The game was aborted because a player left.</p>}
            />
          </SectionPanel>
        ) : null}

        {game.phase === "RESULTS" && game.history ? (
          <SectionPanel emphasis aria-label="Results">
            <GameResultsShell
              className="gang-review"
              heading="Game complete"
              outcome={
                <p className="gang-review__lede">
                  {game.endReason === "won" ? (
                    <>
                      The gang opened <strong>{game.vaultsOpened}</strong> vaults and
                      escaped!
                    </>
                  ) : (
                    <>
                      Alarms tripped <strong>{game.alarms}</strong> times — the heist is
                      over.
                    </>
                  )}
                </p>
              }
              scoresHeading="Heists"
              scores={[
                {
                  id: "vaults",
                  name: "Vaults opened",
                  value: game.vaultsOpened,
                  highlight: game.endReason === "won",
                },
                {
                  id: "alarms",
                  name: "Alarms",
                  value: game.alarms,
                  highlight: game.endReason === "lost",
                },
              ]}
              reviewHeading="Heist review"
            >
              <div className="gang-review__gallery">
                {game.history.map((heist) => (
                  <HeistReview
                    key={`review-${heist.heistNumber}`}
                    heist={heist}
                    players={room.players}
                  />
                ))}
              </div>
            </GameResultsShell>
          </SectionPanel>
        ) : null}

        {isGameOver ? (
          <SectionPanel aria-label="Players" emphasis>
            <GameOverActions
              gameId="theGang"
              playerId={playerId}
              players={room.players}
              isHost={isHost}
              onSetReady={onSetReady}
              onPlayAgain={onPlayAgain}
              onReturnToLobby={onReturnToLobby}
            />
          </SectionPanel>
        ) : null}

        <SectionPanel aria-label="Room">
          <ActionFeedback message={error} />
          <button type="button" className="secondary" onClick={onLeaveRoom}>
            Leave room
          </button>
        </SectionPanel>
      </div>
    </main>
  );
}
