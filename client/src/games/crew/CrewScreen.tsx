import { useEffect, useState } from "react";
import type {
  CrewAttribute,
  CrewCardView,
  CrewColor,
  CrewCommunicableOption,
  CrewEndReason,
  CrewPrivateState,
  CrewPublicCard,
  CrewPublicState,
  CrewSignal,
  GameAction,
  PublicPlayer,
  RoomStatePayload,
} from "../../network/messages.ts";
import { GameOverActions } from "../../components/GameOverActions.tsx";
import { GameResultsShell } from "../../components/GameResultsShell.tsx";
import { ActionFeedback } from "../../components/ActionFeedback.tsx";
import { GameActionArea } from "../../components/GameActionArea.tsx";
import { GamePlayerList } from "../../components/GamePlayerList.tsx";
import { HowToPlay } from "../../components/HowToPlay.tsx";
import { SectionPanel } from "../../components/SectionPanel.tsx";
import { TurnStatus } from "../../components/TurnStatus.tsx";

type CrewScreenProps = {
  playerId: string;
  room: RoomStatePayload;
  game: CrewPublicState;
  privateState: CrewPrivateState | null;
  error: string | null;
  onLeaveRoom: () => void;
  onReturnToLobby: () => void;
  onPlayAgain: () => void;
  onSetReady: (ready: boolean) => void;
  onGameAction: (action: GameAction) => void;
};

const COLOR_LABEL: Record<CrewColor, string> = {
  red: "Red",
  blue: "Blue",
  green: "Green",
  yellow: "Yellow",
  submarine: "Submarine",
};

const COLOR_SHORT: Record<CrewColor, string> = {
  red: "Red",
  blue: "Blue",
  green: "Green",
  yellow: "Yellow",
  submarine: "Sub",
};

function playerName(players: PublicPlayer[], id: string): string {
  return players.find((player) => player.id === id)?.name ?? "Unknown";
}

function formatCard(card: CrewPublicCard | CrewCardView): string {
  return `${COLOR_LABEL[card.color]} ${card.rank}`;
}

function formatTaskStatus(status: string): string {
  if (status === "satisfied") {
    return "Done";
  }
  if (status === "failed") {
    return "Failed";
  }
  return "Open";
}

/**
 * Server descriptions look like "Player 1 must win blue 9".
 * Rewrite with display names and polished card wording.
 */
function formatTaskDescription(
  description: string,
  order: string[],
  players: PublicPlayer[],
): string {
  let text = description.replace(/Player (\d+)/g, (_match, raw: string) => {
    const slot = Number(raw) - 1;
    const id = order[slot];
    if (!id) {
      return "A teammate";
    }
    return playerName(players, id);
  });

  text = text.replace(
    /\b(red|blue|green|yellow|submarine)\s+(\d+)\b/gi,
    (_match, colorRaw: string, rank: string) => {
      const color = colorRaw.toLowerCase() as CrewColor;
      const label = COLOR_LABEL[color] ?? colorRaw;
      return `the ${label} ${rank}`;
    },
  );

  // Cover "must win the the Blue 9" if somehow doubled
  text = text.replace(/\bthe the\b/g, "the");
  return text;
}

function endReasonText(reason: CrewEndReason | undefined): string {
  if (reason === "success") {
    return "Mission complete — all tasks satisfied.";
  }
  if (reason === "failure") {
    return "Mission failed.";
  }
  if (reason === "aborted") {
    return "A player left. This mission was aborted.";
  }
  return "Game over";
}

function resultsHeading(reason: CrewEndReason | undefined): string {
  if (reason === "success") {
    return "Mission complete";
  }
  if (reason === "failure") {
    return "Mission failed";
  }
  if (reason === "aborted") {
    return "Mission aborted";
  }
  return "Game complete";
}

function CrewFaceCard({
  card,
  selected,
  disabled,
  onSelect,
}: {
  card: CrewCardView;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const className = [
    "crew-card",
    `crew-card--${card.color}`,
    selected ? "is-selected" : "",
    disabled ? "is-disabled" : "",
    onSelect && !disabled ? "is-playable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      disabled={disabled || !onSelect}
      onClick={onSelect}
      aria-label={formatCard(card)}
    >
      <span className="crew-card__rank">{card.rank}</span>
      <span className="crew-card__suit">{COLOR_SHORT[card.color]}</span>
    </button>
  );
}

function CrewPublicFace({ card }: { card: CrewPublicCard }) {
  return (
    <div className={`crew-card crew-card--${card.color} crew-card--static`}>
      <span className="crew-card__rank">{card.rank}</span>
      <span className="crew-card__suit">{COLOR_SHORT[card.color]}</span>
    </div>
  );
}

export function CrewScreen({
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
}: CrewScreenProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [commSignal, setCommSignal] = useState<CrewSignal | null>(null);
  const [commAttribute, setCommAttribute] = useState<CrewAttribute | null>(
    null,
  );

  const legal = privateState?.legalActions ?? [];
  const canBegin = legal.includes("crew_begin_mission");
  const canPlay = legal.includes("crew_play_card");
  const canCommunicate = legal.includes("crew_communicate");
  const playable = new Set(privateState?.playableCardIds ?? []);
  const hand = privateState?.hand ?? [];
  const options = privateState?.communicableOptions ?? [];
  const myTurn = game.currentPlayerId === playerId;
  const self = room.players.find((player) => player.id === playerId);
  const isHost = self?.isHost ?? false;
  const currentName = playerName(room.players, game.currentPlayerId);
  const selectedCard = hand.find((card) => card.cardId === selectedCardId);

  useEffect(() => {
    setSelectedCardId(null);
    setCommSignal(null);
    setCommAttribute(null);
  }, [game.phase, game.currentPlayerId, game.currentTrick.length]);

  const matchingOptions: CrewCommunicableOption[] = selectedCardId
    ? options.filter((option) => option.cardId === selectedCardId)
    : [];

  const canConfirmComm =
    canCommunicate &&
    selectedCardId !== null &&
    commSignal !== null &&
    commAttribute !== null &&
    matchingOptions.some(
      (option) =>
        option.signal === commSignal && option.attribute === commAttribute,
    );

  const isTasks = game.phase === "TASKS";
  const isPlaying = game.phase === "PLAYING";
  const isGameOver = game.phase === "RESULTS" || game.phase === "ABORTED";

  return (
    <main className="page crew-page">
      <h1>The Crew</h1>
      <p className="lede">
        Room <span className="room-code">{room.roomCode}</span>
      </p>

      <div className="game-stack game-stack--table">
        <SectionPanel aria-label="How to play">
          <HowToPlay gameId="crew" />
        </SectionPanel>

        <SectionPanel
          className="crew-situation"
          emphasis={isPlaying || isTasks}
          aria-label="Mission"
        >
          <header className="crew-mission">
            <h2 className="crew-mission__title">{game.mission.title}</h2>
            <p className="crew-mission__description">
              {game.mission.description}
            </p>
            <div className="crew-trump">
              <span className="crew-trump__label">Trump</span>
              <span className="crew-trump__value">Submarine</span>
            </div>
          </header>

          {isTasks ? (
            <div className="crew-briefing">
              <h3 className="crew-briefing__heading">Mission Briefing</h3>
              <p className="crew-briefing__copy">
                Review the mission tasks, then begin.
              </p>
            </div>
          ) : (
            <TurnStatus
              className="crew-turn-banner"
              active={
                isPlaying && myTurn ? "you" : isPlaying ? "other" : "idle"
              }
              title={
                isPlaying
                  ? myTurn
                    ? "Your turn"
                    : `${currentName}'s turn`
                  : game.phase === "RESULTS"
                    ? "Results"
                    : "Aborted"
              }
              detail={
                isPlaying
                  ? myTurn
                    ? "Play a legal card from your hand."
                    : `Waiting for ${currentName}…`
                  : endReasonText(game.endReason)
              }
            />
          )}
        </SectionPanel>

        <SectionPanel aria-label="Tasks">
          <h2 className="crew-section-title">Tasks</h2>
          <ul className="crew-tasks">
            {game.tasks.map((task) => (
              <li
                key={task.id}
                className={`crew-task crew-task--${task.status}`}
              >
                <span className="crew-task__status">
                  {formatTaskStatus(task.status)}
                </span>
                <p className="crew-task__text">
                  {formatTaskDescription(
                    task.description,
                    game.order,
                    room.players,
                  )}
                </p>
              </li>
            ))}
          </ul>
        </SectionPanel>

        <SectionPanel className="crew-table" aria-label="Seats">
          <div className="crew-seats">
            {game.order.map((ownerId) => {
              const size = game.handSizes[ownerId] ?? 0;
              const isCurrent = game.currentPlayerId === ownerId && isPlaying;
              const isYou = ownerId === playerId;
              const marker = game.communications.find(
                (entry) => entry.playerId === ownerId,
              );
              return (
                <div
                  key={ownerId}
                  className={[
                    "crew-seat",
                    isCurrent ? "is-turn" : "",
                    isYou ? "is-you" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="crew-seat__header">
                    <span className="crew-seat__name">
                      {playerName(room.players, ownerId)}
                    </span>
                    {isYou ? <em className="crew-seat__you">you</em> : null}
                    {isCurrent ? <em>turn</em> : null}
                  </div>
                  <div className="crew-seat__meta">
                    <span className="crew-seat__hand-count">
                      {size} {size === 1 ? "card" : "cards"}
                    </span>
                    <span className="crew-seat__comm">
                      {marker
                        ? `${marker.signal} ${marker.attribute}: ${formatCard(marker.card)}`
                        : "No communication"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionPanel>

        <SectionPanel
          emphasis={Boolean(myTurn && isPlaying) || canBegin}
          aria-label="Your hand"
        >
          <div className="crew-own-seat">
            <div className="crew-own-seat__label">
              <span>Your hand</span>
              {myTurn && isPlaying ? <em>turn</em> : null}
            </div>
            <div className="crew-hand">
              {hand.map((card) => {
                const selectable = canPlay || canCommunicate;
                return (
                  <CrewFaceCard
                    key={card.cardId}
                    card={card}
                    selected={selectedCardId === card.cardId}
                    disabled={
                      canPlay
                        ? !playable.has(card.cardId)
                        : canCommunicate
                          ? !options.some((o) => o.cardId === card.cardId)
                          : !selectable
                    }
                    onSelect={
                      selectable
                        ? () => {
                            setSelectedCardId((prev) =>
                              prev === card.cardId ? null : card.cardId,
                            );
                            setCommSignal(null);
                            setCommAttribute(null);
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>

            {canBegin ? (
              <GameActionArea label="Your action">
                <button
                  type="button"
                  className="crew-begin"
                  onClick={() => onGameAction({ type: "crew_begin_mission" })}
                >
                  Begin mission
                </button>
              </GameActionArea>
            ) : null}

            <div className="crew-card-actions">
              {canPlay ? (
                <button
                  type="button"
                  disabled={!selectedCard || !playable.has(selectedCard.cardId)}
                  onClick={() => {
                    if (!selectedCard) {
                      return;
                    }
                    onGameAction({
                      type: "crew_play_card",
                      cardId: selectedCard.cardId,
                    });
                    setSelectedCardId(null);
                  }}
                >
                  {selectedCard
                    ? `Play ${formatCard(selectedCard)}`
                    : "Play selected"}
                </button>
              ) : null}
            </div>

            {canCommunicate ? (
              <div className="crew-comm-tray">
                <h2 className="crew-section-title">Communicate</h2>
                <p className="status">
                  Select a card, then choose a legal signal. One communication
                  per mission.
                </p>
                {selectedCardId ? (
                  <div className="crew-comm-options">
                    {(["highest", "lowest", "only"] as CrewSignal[]).map(
                      (signal) =>
                        (["color", "rank"] as CrewAttribute[]).map(
                          (attribute) => {
                            const legalOption = matchingOptions.some(
                              (option) =>
                                option.signal === signal &&
                                option.attribute === attribute,
                            );
                            if (!legalOption) {
                              return null;
                            }
                            const active =
                              commSignal === signal &&
                              commAttribute === attribute;
                            return (
                              <button
                                key={`${signal}-${attribute}`}
                                type="button"
                                className={
                                  active
                                    ? "crew-comm-chip is-active"
                                    : "crew-comm-chip"
                                }
                                onClick={() => {
                                  setCommSignal(signal);
                                  setCommAttribute(attribute);
                                }}
                              >
                                {signal} {attribute}
                              </button>
                            );
                          },
                        ),
                    )}
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={!canConfirmComm}
                  onClick={() => {
                    if (!selectedCardId || !commSignal || !commAttribute) {
                      return;
                    }
                    onGameAction({
                      type: "crew_communicate",
                      cardId: selectedCardId,
                      signal: commSignal,
                      attribute: commAttribute,
                    });
                    setSelectedCardId(null);
                    setCommSignal(null);
                    setCommAttribute(null);
                  }}
                >
                  Confirm communication
                </button>
              </div>
            ) : null}

            {game.communications.some((entry) => entry.playerId === playerId) ? (
              <p className="status">
                You have already communicated this mission.
              </p>
            ) : null}
          </div>
        </SectionPanel>

        {isPlaying || game.currentTrick.length > 0 ? (
          <SectionPanel aria-label="Current trick">
            <div className="crew-trick">
              <h2 className="crew-section-title">Current trick</h2>
              {game.currentTrick.length === 0 ? (
                <p className="status">Waiting for the first card.</p>
              ) : (
                <div className="crew-trick-row">
                  {game.currentTrick.map((play) => (
                    <div
                      key={`${play.playerId}-${play.card.color}-${play.card.rank}`}
                      className="crew-trick-play"
                    >
                      <span className="crew-trick-play__name">
                        {playerName(room.players, play.playerId)}
                      </span>
                      <CrewPublicFace card={play.card} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionPanel>
        ) : null}

        {isPlaying &&
        (game.completedTricks.length > 0 || game.communications.length > 0) ? (
          <SectionPanel aria-label="History">
            <details className="crew-history">
              <summary>
                History (
                {game.completedTricks.length + game.communications.length})
              </summary>
              <ul className="crew-history__list">
                {game.communications.map((marker, index) => (
                  <li key={`comm-${marker.playerId}-${index}`}>
                    {playerName(room.players, marker.playerId)} communicated{" "}
                    {marker.signal} {marker.attribute}: {formatCard(marker.card)}
                  </li>
                ))}
                {[...game.completedTricks].reverse().map((trick, index) => (
                  <li key={`hist-trick-${index}`}>
                    Trick won by {playerName(room.players, trick.winnerId)}:{" "}
                    {trick.plays
                      .map(
                        (play) =>
                          `${playerName(room.players, play.playerId)} ${formatCard(play.card)}`,
                      )
                      .join(" · ")}
                  </li>
                ))}
              </ul>
            </details>
          </SectionPanel>
        ) : null}

        {game.phase === "RESULTS" || game.phase === "ABORTED" ? (
          <SectionPanel emphasis aria-label="Results">
            <GameResultsShell
              className="crew-review"
              heading={resultsHeading(game.endReason)}
              outcome={
                <>
                  <p className="crew-review__mission">
                    <strong>{game.mission.title}</strong>
                    {game.mission.description
                      ? ` — ${game.mission.description}`
                      : ""}
                  </p>
                  <p>{endReasonText(game.endReason)}</p>
                </>
              }
              reviewHeading="Mission summary"
            >
              <div className="crew-review__section">
                <h3 className="crew-section-title">Tasks</h3>
                <ul className="crew-tasks">
                  {game.tasks.map((task) => (
                    <li
                      key={`review-${task.id}`}
                      className={`crew-task crew-task--${task.status}`}
                    >
                      <span className="crew-task__status">
                        {formatTaskStatus(task.status)}
                      </span>
                      <p className="crew-task__text">
                        {formatTaskDescription(
                          task.description,
                          game.order,
                          room.players,
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              {game.communications.length > 0 ? (
                <div className="crew-review__section">
                  <h3 className="crew-section-title">Communications</h3>
                  <ul className="crew-review__list">
                    {game.communications.map((marker, index) => (
                      <li key={`rev-comm-${index}`}>
                        {playerName(room.players, marker.playerId)}:{" "}
                        {marker.signal} {marker.attribute} —{" "}
                        {formatCard(marker.card)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {game.completedTricks.length > 0 ? (
                <div className="crew-review__section">
                  <h3 className="crew-section-title">Tricks</h3>
                  <ol className="crew-review__list">
                    {game.completedTricks.map((trick, index) => (
                      <li key={`rev-trick-${index}`}>
                        Won by {playerName(room.players, trick.winnerId)}:{" "}
                        {trick.plays
                          .map(
                            (play) =>
                              `${playerName(room.players, play.playerId)} ${formatCard(play.card)}`,
                          )
                          .join(" · ")}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {game.finalHands ? (
                <div className="crew-review__section">
                  <h3 className="crew-section-title">Final hands</h3>
                  <div className="crew-review__hands">
                    {game.order.map((ownerId) => {
                      const cards = game.finalHands?.[ownerId] ?? [];
                      return (
                        <div key={ownerId} className="crew-review__hand">
                          <div className="crew-seat__header">
                            <span className="crew-seat__name">
                              {playerName(room.players, ownerId)}
                            </span>
                            {ownerId === playerId ? (
                              <em className="crew-seat__you">you</em>
                            ) : null}
                          </div>
                          {cards.length === 0 ? (
                            <p className="status">No cards left</p>
                          ) : (
                            <div className="crew-hand">
                              {cards.map((card, index) => (
                                <CrewPublicFace
                                  key={`${ownerId}-${card.color}-${card.rank}-${index}`}
                                  card={card}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </GameResultsShell>
          </SectionPanel>
        ) : null}

        {game.phase === "RESULTS" || game.phase === "ABORTED" ? (
          <SectionPanel aria-label="Players" emphasis>
            <GameOverActions
              gameId="crew"
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
          {!isGameOver ? (
            <GamePlayerList
              players={room.players}
              playerId={playerId}
              renderExtraTags={(player) =>
                game.currentPlayerId === player.id && isPlaying ? (
                  <em>turn</em>
                ) : null
              }
            />
          ) : null}

          <ActionFeedback message={error} />

          <button type="button" className="secondary" onClick={onLeaveRoom}>
            Leave room
          </button>
        </SectionPanel>
      </div>
    </main>
  );
}
