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
import { GameActionArea } from "../../components/GameActionArea.tsx";
import { GameOverActions } from "../../components/GameOverActions.tsx";
import { GameResultsShell } from "../../components/GameResultsShell.tsx";
import { HowToPlay } from "../../components/HowToPlay.tsx";
import { SectionPanel } from "../../components/SectionPanel.tsx";
import { WaitingStatus } from "../../components/WaitingStatus.tsx";
import {
  cardLabel,
  CHIP_COLOR_LABEL,
  isRedSuit,
  PHASE_LABEL,
  rankLabel,
  suitSymbol,
} from "./cards.ts";

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

function chipHeldBy(game: GangPublicState, targetId: string): number | null {
  return game.chipHeld.find((entry) => entry.playerId === targetId)?.star ?? null;
}

function PlayingCard({ card }: { card: GangCard }) {
  const red = isRedSuit(card.suit);
  return (
    <span
      className={`gang-card${red ? " gang-card--red" : ""}`}
      aria-label={cardLabel(card)}
    >
      <span className="gang-card__rank">{rankLabel(card.rank)}</span>
      <span className="gang-card__suit">{suitSymbol(card.suit)}</span>
    </span>
  );
}

function ChipBadge({
  star,
  color,
  size = "normal",
}: {
  star: number;
  color: GangChipColor;
  size?: "normal" | "small";
}) {
  return (
    <span
      className={`gang-chip gang-chip--${color}${size === "small" ? " gang-chip--small" : ""}`}
      aria-label={`${star} star`}
    >
      {"★".repeat(star)}
    </span>
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
        {heist.reveals.map((reveal) => (
          <li key={`${heist.heistNumber}-${reveal.playerId}`}>
            <ChipBadge star={reveal.star} color="red" size="small" />
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
  const legal = privateState?.legalActions ?? [];
  const myChip = chipHeldBy(game, playerId);
  const canTakeCenter = legal.includes("gang_take_center");
  const canTakeFromPlayer = legal.includes("gang_take_from_player");
  const canReturn = legal.includes("gang_return_chip");
  const waitingPlayers = room.players.filter(
    (player) => chipHeldBy(game, player.id) === null,
  );

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
          : ` — heist ${game.heistNumber}`}
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
                    {[1, 2, 3].map((slot) => (
                      <span
                        key={`alarm-${slot}`}
                        className={`gang-scoreboard__dot gang-scoreboard__dot--alarm${
                          game.alarms >= slot ? " gang-scoreboard__dot--filled" : ""
                        }`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <span className="gang-scoreboard__count">{game.alarms}/3</span>
                </div>
              </div>
            </SectionPanel>

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

            {isChipPhase ? (
              <SectionPanel aria-label="Chip selection" emphasis>
                <h2 className="gang-section-title">
                  {PHASE_LABEL[game.phase]} — {CHIP_COLOR_LABEL[game.chipColor]} chips
                </h2>
                <p className="status">
                  Pick one chip for your hand strength (1★ weakest, {game.playerCount}★
                  strongest). Everyone must choose before the next street.
                </p>

                <div className="gang-chip-board">
                  <div className="gang-chip-board__center">
                    <h3 className="gang-chip-board__heading">Center</h3>
                    <div className="gang-chip-board__chips">
                      {game.chipCenter.length === 0 ? (
                        <span className="status">Empty</span>
                      ) : (
                        game.chipCenter.map((star) => (
                          <button
                            key={`center-${star}`}
                            type="button"
                            className="gang-chip-button"
                            disabled={!canTakeCenter}
                            onClick={() =>
                              onGameAction({ type: "gang_take_center", star })
                            }
                          >
                            <ChipBadge star={star} color={game.chipColor} />
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <ul className="gang-chip-board__players">
                    {room.players.map((player) => {
                      const star = chipHeldBy(game, player.id);
                      return (
                        <li
                          key={player.id}
                          className={`gang-chip-board__player${
                            star === null ? " gang-chip-board__player--waiting" : ""
                          }`}
                        >
                          <span className="gang-chip-board__name">
                            {player.name}
                            {player.id === playerId ? " (you)" : ""}
                          </span>
                          {star !== null ? (
                            canTakeFromPlayer && player.id !== playerId ? (
                              <button
                                type="button"
                                className="gang-chip-button"
                                onClick={() =>
                                  onGameAction({
                                    type: "gang_take_from_player",
                                    fromPlayerId: player.id,
                                  })
                                }
                              >
                                <ChipBadge star={star} color={game.chipColor} />
                                <span className="gang-chip-button__hint">Take</span>
                              </button>
                            ) : (
                              <ChipBadge star={star} color={game.chipColor} />
                            )
                          ) : (
                            <span className="gang-chip-board__waiting">Choosing…</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {myChip !== null ? (
                  <GameActionArea>
                    <p className="status">
                      You hold{" "}
                      <ChipBadge star={myChip} color={game.chipColor} size="small" />.
                    </p>
                    {canReturn ? (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => onGameAction({ type: "gang_return_chip" })}
                      >
                        Return chip to center
                      </button>
                    ) : null}
                  </GameActionArea>
                ) : canTakeCenter || canTakeFromPlayer ? (
                  <GameActionArea>
                    <p className="status">Take a chip from the center or another player.</p>
                  </GameActionArea>
                ) : null}

                {myChip !== null && waitingPlayers.length > 0 ? (
                  <WaitingStatus
                    message={`Waiting for ${waitingPlayers
                      .map((player) => player.name)
                      .join(", ")} to choose a chip.`}
                  />
                ) : null}
              </SectionPanel>
            ) : null}

            {game.chipHistory.length > 0 ? (
              <SectionPanel aria-label="Chip history">
                <details className="gang-history">
                  <summary>Chip history ({game.chipHistory.length})</summary>
                  <ul className="gang-history__list">
                    {game.chipHistory.map((snapshot) => (
                      <li key={snapshot.color}>
                        <strong>{CHIP_COLOR_LABEL[snapshot.color]}</strong>
                        {snapshot.held.map((entry) => (
                          <span key={entry.playerId} className="gang-history__entry">
                            {playerName(room.players, entry.playerId)}: {entry.star}★
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
