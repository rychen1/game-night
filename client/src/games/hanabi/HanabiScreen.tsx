import { useEffect, useState, type ReactNode } from "react";
import type {
  GameAction,
  HanabiCardView,
  HanabiClue,
  HanabiColor,
  HanabiEndReason,
  HanabiKnowledge,
  HanabiLogEntry,
  HanabiPrivateState,
  HanabiPublicState,
  HanabiRank,
  PublicPlayer,
  RoomStatePayload,
} from "../../network/messages.ts";
import { GameOverActions } from "../../components/GameOverActions.tsx";
import { GameResultsShell } from "../../components/GameResultsShell.tsx";
import { ActionFeedback } from "../../components/ActionFeedback.tsx";
import { GamePlayerList } from "../../components/GamePlayerList.tsx";
import { HowToPlay } from "../../components/HowToPlay.tsx";
import { SectionPanel } from "../../components/SectionPanel.tsx";
import { TurnStatus } from "../../components/TurnStatus.tsx";

const COLORS: HanabiColor[] = ["red", "yellow", "green", "blue", "white"];
const RANKS: HanabiRank[] = [1, 2, 3, 4, 5];
const COLOR_LABEL: Record<HanabiColor, string> = {
  red: "Red",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  white: "White",
};

type HanabiScreenProps = {
  playerId: string;
  name: string;
  room: RoomStatePayload;
  game: HanabiPublicState;
  privateState: HanabiPrivateState | null;
  error: string | null;
  onNameChange: (name: string) => void;
  onSetName: () => void;
  onLeaveRoom: () => void;
  onReturnToLobby: () => void;
  onPlayAgain: () => void;
  onSetReady: (ready: boolean) => void;
  onGameAction: (action: GameAction) => void;
};

function playerName(players: PublicPlayer[], id: string): string {
  return players.find((player) => player.id === id)?.name ?? "Unknown";
}

function endReasonText(
  reason: HanabiEndReason | undefined,
  score?: number,
): string {
  if (reason === "perfect") {
    return `Perfect fireworks — score ${score ?? 25}`;
  }
  if (reason === "fuses") {
    return `The fuses ran out — score ${score ?? 0}`;
  }
  if (reason === "deck") {
    return `Last turns finished — score ${score ?? 0}`;
  }
  if (reason === "aborted") {
    return "A player left. This game was aborted.";
  }
  return "Game over";
}

function resultsHeadline(reason: HanabiEndReason | undefined): string {
  if (reason === "perfect") {
    return "Perfect fireworks";
  }
  if (reason === "fuses") {
    return "The fuses ran out";
  }
  if (reason === "deck") {
    return "Last turns finished";
  }
  if (reason === "aborted") {
    return "A player left. This game was aborted.";
  }
  return "Game over";
}

function logText(entry: HanabiLogEntry, players: PublicPlayer[]): string {
  const actor = playerName(players, entry.actorId);
  if (entry.type === "clue") {
    const target = playerName(players, entry.targetId);
    const clue =
      entry.clue.type === "color"
        ? COLOR_LABEL[entry.clue.value]
        : String(entry.clue.value);
    return `${actor} clued ${target}: ${clue}`;
  }
  if (entry.type === "play") {
    const card = `${COLOR_LABEL[entry.card.color]} ${entry.card.rank}`;
    return entry.success
      ? `${actor} played ${card}`
      : `${actor} misplayed ${card}`;
  }
  return `${actor} discarded ${COLOR_LABEL[entry.card.color]} ${entry.card.rank}`;
}

function clueTouches(cards: HanabiCardView[], clue: HanabiClue): boolean {
  return cards.some((card) => cardMatchesClue(card, clue));
}

function cardMatchesClue(card: HanabiCardView, clue: HanabiClue): boolean {
  if (clue.type === "color") {
    return card.color === clue.value;
  }
  return card.rank === clue.value;
}

function hasAnyKnowledge(knowledge: HanabiKnowledge): boolean {
  return Boolean(
    knowledge.knownColor ||
      knowledge.knownRank ||
      knowledge.notColors.length > 0 ||
      knowledge.notRanks.length > 0,
  );
}

export function HanabiScreen({
  playerId,
  name,
  room,
  game,
  privateState,
  error,
  onNameChange,
  onSetName,
  onLeaveRoom,
  onReturnToLobby,
  onPlayAgain,
  onSetReady,
  onGameAction,
}: HanabiScreenProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [clueTargetId, setClueTargetId] = useState<string | null>(null);
  const [previewClue, setPreviewClue] = useState<HanabiClue | null>(null);

  const isHost = room.hostPlayerId === playerId;
  const myTurn = game.phase === "PLAYING" && game.currentPlayerId === playerId;
  const canClue = privateState?.legalActions.includes("give_clue") ?? false;
  const canPlay = privateState?.legalActions.includes("play_card") ?? false;
  const canDiscard =
    privateState?.legalActions.includes("discard_card") ?? false;
  const canSelectCard = myTurn && (canPlay || canDiscard);
  const currentName = playerName(room.players, game.currentPlayerId);
  const ownHand = privateState?.hands[playerId] ?? [];
  const others = game.order.filter((id) => id !== playerId);
  const hideOwnFaces = game.phase === "PLAYING";

  useEffect(() => {
    setSelectedCardId(null);
    setClueTargetId(null);
    setPreviewClue(null);
  }, [game.currentPlayerId, game.log.length, game.phase]);

  function giveClue(clue: HanabiClue): void {
    if (!clueTargetId) {
      return;
    }
    onGameAction({
      type: "give_clue",
      targetPlayerId: clueTargetId,
      clue,
    });
  }

  function toggleOwnCard(cardId: string): void {
    if (!canSelectCard) {
      return;
    }
    setSelectedCardId((prev) => (prev === cardId ? null : cardId));
  }

  return (
    <main className="page hanabi-page">
      <h1>Hanabi</h1>
      <p className="lede">
        Room <span className="room-code">{room.roomCode}</span>
      </p>

      <div className="game-stack game-stack--table">
        <SectionPanel aria-label="How to play">
          <HowToPlay gameId="hanabi" />
        </SectionPanel>

        <SectionPanel
          emphasis={game.phase === "PLAYING"}
          aria-label="Current situation"
        >
          <TurnStatus
            className="hanabi-turn-banner"
            active={
              game.phase === "PLAYING" ? (myTurn ? "you" : "other") : "idle"
            }
            title={
              game.phase === "PLAYING"
                ? myTurn
                  ? "Your turn"
                  : `${currentName}'s turn`
                : game.phase === "RESULTS"
                  ? "Results"
                  : "Aborted"
            }
            detail={
              game.phase === "PLAYING"
                ? myTurn
                  ? "Clue a teammate, or play / discard a card from your hand."
                  : `Waiting for ${currentName}…`
                : endReasonText(game.endReason, game.score)
            }
          />

          <div className="hanabi-resources">
            <TokenStrip
              label="Clues"
              kind="clue"
              filled={game.clueTokens}
              total={8}
            />
            <TokenStrip
              label="Fuses"
              kind="fuse"
              filled={game.fuseTokens}
              total={3}
            />
            <DeckPile count={game.deckCount} />
            {game.finalTurnsLeft !== null ? (
              <div className="hanabi-countdown">
                Last turns <strong>{game.finalTurnsLeft}</strong>
              </div>
            ) : null}
          </div>
        </SectionPanel>

        <SectionPanel className="hanabi-table" aria-label="Table">
          <div className="hanabi-opponents">
            {others.map((ownerId) => {
              const isCurrent = game.currentPlayerId === ownerId;
              const isClueTarget = clueTargetId === ownerId;
              const cards = privateState?.hands[ownerId] ?? [];
              return (
                <div
                  key={ownerId}
                  className={[
                    "hanabi-seat",
                    isCurrent ? "is-turn" : "",
                    isClueTarget ? "is-clue-target" : "",
                    canClue ? "is-clueable" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    if (canClue) {
                      setClueTargetId(ownerId);
                      setPreviewClue(null);
                    }
                  }}
                >
                  <div className="hanabi-seat-label">
                    <span>{playerName(room.players, ownerId)}</span>
                    {isCurrent ? <em>turn</em> : null}
                    {isClueTarget ? <em>clue target</em> : null}
                  </div>
                  <HandFan size="md">
                    {cards.map((card) => {
                      if (!card.color || !card.rank) {
                        return null;
                      }
                      const previewMatch =
                        isClueTarget &&
                        previewClue &&
                        cardMatchesClue(card, previewClue);
                      const previewMiss =
                        isClueTarget &&
                        previewClue &&
                        !cardMatchesClue(card, previewClue);
                      return (
                        <FaceCard
                          key={card.cardId}
                          color={card.color}
                          rank={card.rank}
                          knowledge={card.knowledge}
                          previewMatch={Boolean(previewMatch)}
                          previewMiss={Boolean(previewMiss)}
                        />
                      );
                    })}
                  </HandFan>
                </div>
              );
            })}
          </div>

          <div className="hanabi-center">
            <div className="hanabi-stacks-row">
              <h2 className="hanabi-section-title">Played</h2>
              <div className="hanabi-stacks">
                {COLORS.map((color) => {
                  const rank = game.stacks[color];
                  return (
                    <div key={color} className="hanabi-stack-slot">
                      {rank > 0 ? (
                        <FaceCard
                          color={color}
                          rank={rank as HanabiRank}
                          size="sm"
                          stack
                        />
                      ) : (
                        <div
                          className={`hanabi-stack-empty hanabi-face--${color}`}
                          aria-label={`${COLOR_LABEL[color]} stack empty`}
                        >
                          <span>{COLOR_LABEL[color].charAt(0)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="hanabi-discard-row">
              <h2 className="hanabi-section-title">
                Discard
                {game.discard.length > 0 ? (
                  <span className="hanabi-count">{game.discard.length}</span>
                ) : null}
              </h2>
              {game.discard.length === 0 ? (
                <p className="status">Empty</p>
              ) : (
                <HandFan size="sm">
                  {game.discard.slice(-8).map((card, index) => (
                    <FaceCard
                      key={`${card.color}-${card.rank}-${index}`}
                      color={card.color}
                      rank={card.rank}
                      size="sm"
                    />
                  ))}
                </HandFan>
              )}
            </div>
          </div>
        </SectionPanel>

        <SectionPanel
          emphasis={myTurn && game.phase === "PLAYING"}
          aria-label="Your hand"
        >
          <div className="hanabi-own-seat">
            <div className="hanabi-seat-label">
              <span>Your hand</span>
              {myTurn ? <em>you</em> : null}
            </div>
            <HandFan size="lg" emphasized>
              {ownHand.map((card, index) =>
                hideOwnFaces ? (
                  <BackCard
                    key={card.cardId}
                    position={index + 1}
                    knowledge={card.knowledge}
                    selectable={canSelectCard}
                    selected={selectedCardId === card.cardId}
                    onSelect={() => toggleOwnCard(card.cardId)}
                  />
                ) : card.color && card.rank ? (
                  <FaceCard
                    key={card.cardId}
                    color={card.color}
                    rank={card.rank}
                    knowledge={card.knowledge}
                    size="lg"
                  />
                ) : (
                  <BackCard
                    key={card.cardId}
                    position={index + 1}
                    knowledge={card.knowledge}
                    selectable={false}
                    selected={false}
                    onSelect={() => undefined}
                  />
                ),
              )}
            </HandFan>

            {myTurn ? (
              <div className="hanabi-card-actions">
                <button
                  type="button"
                  disabled={!canPlay || !selectedCardId}
                  onClick={() => {
                    if (!selectedCardId) {
                      return;
                    }
                    onGameAction({ type: "play_card", cardId: selectedCardId });
                  }}
                >
                  Play selected
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={!canDiscard || !selectedCardId}
                  onClick={() => {
                    if (!selectedCardId) {
                      return;
                    }
                    onGameAction({
                      type: "discard_card",
                      cardId: selectedCardId,
                    });
                  }}
                >
                  Discard selected
                </button>
                {!selectedCardId && (canPlay || canDiscard) ? (
                  <span className="status">Select a card from your hand.</span>
                ) : null}
              </div>
            ) : null}
          </div>

          {canClue ? (
            <div className="hanabi-clue-tray">
              <h2 className="hanabi-section-title">Give a clue</h2>
              <p className="status">
                {clueTargetId
                  ? `Cluing ${playerName(room.players, clueTargetId)} — choose color or rank.`
                  : "Click a teammate’s hand, then choose a color or rank."}
              </p>
              <div className="hanabi-clue-targets">
                {others.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={clueTargetId === id ? undefined : "secondary"}
                    onClick={() => {
                      setClueTargetId(id);
                      setPreviewClue(null);
                    }}
                  >
                    {playerName(room.players, id)}
                  </button>
                ))}
              </div>
              {clueTargetId ? (
                <>
                  <div className="hanabi-clue-options">
                    {COLORS.map((color) => {
                      const clue: HanabiClue = { type: "color", value: color };
                      const targetCards =
                        privateState?.hands[clueTargetId] ?? [];
                      const legal = clueTouches(targetCards, clue);
                      return (
                        <button
                          key={color}
                          type="button"
                          className={`hanabi-clue-chip hanabi-face--${color}`}
                          disabled={!legal}
                          onMouseEnter={() => legal && setPreviewClue(clue)}
                          onMouseLeave={() => setPreviewClue(null)}
                          onFocus={() => legal && setPreviewClue(clue)}
                          onBlur={() => setPreviewClue(null)}
                          onClick={() => giveClue(clue)}
                        >
                          {COLOR_LABEL[color]}
                        </button>
                      );
                    })}
                  </div>
                  <div className="hanabi-clue-options">
                    {RANKS.map((rank) => {
                      const clue: HanabiClue = { type: "rank", value: rank };
                      const targetCards =
                        privateState?.hands[clueTargetId] ?? [];
                      const legal = clueTouches(targetCards, clue);
                      return (
                        <button
                          key={rank}
                          type="button"
                          className="hanabi-clue-chip hanabi-clue-rank"
                          disabled={!legal}
                          onMouseEnter={() => legal && setPreviewClue(clue)}
                          onMouseLeave={() => setPreviewClue(null)}
                          onFocus={() => legal && setPreviewClue(clue)}
                          onBlur={() => setPreviewClue(null)}
                          onClick={() => giveClue(clue)}
                        >
                          {rank}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </SectionPanel>

        {game.phase === "PLAYING" && game.log.length > 0 ? (
          <SectionPanel aria-label="History">
            <details className="hanabi-history">
              <summary>History ({game.log.length})</summary>
              <ul className="hanabi-history__list">
                {[...game.log].reverse().map((entry, index) => (
                  <li key={`${entry.type}-${index}`}>
                    {logText(entry, room.players)}
                  </li>
                ))}
              </ul>
            </details>
          </SectionPanel>
        ) : null}

        {game.phase === "RESULTS" || game.phase === "ABORTED" ? (
          <SectionPanel emphasis aria-label="Results">
            <GameResultsShell
              className="hanabi-review"
              heading="Game complete"
              outcome={<p>{resultsHeadline(game.endReason)}</p>}
              scores={
                game.score !== undefined
                  ? [
                      {
                        id: "team",
                        name: "Team",
                        value: game.score,
                        highlight: true,
                      },
                    ]
                  : undefined
              }
              reviewHeading="Review"
              footer={
                <GameOverActions
                  playerId={playerId}
                  players={room.players}
                  isHost={isHost}
                  onSetReady={onSetReady}
                  onPlayAgain={onPlayAgain}
                  onReturnToLobby={onReturnToLobby}
                />
              }
            >
              <div className="hanabi-review__section">
                <h3 className="hanabi-section-title">Final stacks</h3>
                <div className="hanabi-stacks">
                  {COLORS.map((color) => {
                    const rank = game.stacks[color];
                    return (
                      <div key={color} className="hanabi-stack-slot">
                        {rank > 0 ? (
                          <FaceCard
                            color={color}
                            rank={rank as HanabiRank}
                            size="sm"
                            stack
                          />
                        ) : (
                          <div
                            className={`hanabi-stack-empty hanabi-face--${color}`}
                            aria-label={`${COLOR_LABEL[color]} stack empty`}
                          >
                            <span>{COLOR_LABEL[color].charAt(0)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="hanabi-review__section">
                <h3 className="hanabi-section-title">
                  Discard
                  {game.discard.length > 0 ? (
                    <span className="hanabi-count">{game.discard.length}</span>
                  ) : null}
                </h3>
                {game.discard.length === 0 ? (
                  <p className="status">Empty</p>
                ) : (
                  <HandFan size="sm">
                    {game.discard.map((card, index) => (
                      <FaceCard
                        key={`review-discard-${card.color}-${card.rank}-${index}`}
                        color={card.color}
                        rank={card.rank}
                        size="sm"
                      />
                    ))}
                  </HandFan>
                )}
              </div>

              <div className="hanabi-review__section">
                <h3 className="hanabi-section-title">Final hands</h3>
                <div className="hanabi-review__hands">
                  {game.order.map((ownerId) => {
                    const cards = privateState?.hands[ownerId] ?? [];
                    return (
                      <div key={ownerId} className="hanabi-review__hand">
                        <div className="hanabi-seat-label">
                          <span>{playerName(room.players, ownerId)}</span>
                          {ownerId === playerId ? <em>you</em> : null}
                        </div>
                        <HandFan size="sm">
                          {cards.map((card) =>
                            card.color && card.rank ? (
                              <FaceCard
                                key={card.cardId}
                                color={card.color}
                                rank={card.rank}
                                size="sm"
                              />
                            ) : null,
                          )}
                        </HandFan>
                      </div>
                    );
                  })}
                </div>
              </div>

              {game.log.length > 0 ? (
                <div className="hanabi-review__section">
                  <h3 className="hanabi-section-title">Action history</h3>
                  <ol className="hanabi-review__log">
                    {game.log.map((entry, index) => (
                      <li key={`review-${entry.type}-${index}`}>
                        {logText(entry, room.players)}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </GameResultsShell>
          </SectionPanel>
        ) : null}

        <SectionPanel aria-label="Room">
          <GamePlayerList
            players={room.players}
            playerId={playerId}
            showReady={game.phase === "RESULTS" || game.phase === "ABORTED"}
            renderExtraTags={(player) =>
              game.currentPlayerId === player.id && game.phase === "PLAYING" ? (
                <em>turn</em>
              ) : null
            }
          />

          <form
            className="inline"
            onSubmit={(event) => {
              event.preventDefault();
              onSetName();
            }}
          >
            <label>
              Display name
              <input
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                maxLength={32}
              />
            </label>
            <button type="submit">Update name</button>
          </form>

          <ActionFeedback message={error} />

          <button type="button" className="secondary" onClick={onLeaveRoom}>
            Leave room
          </button>
        </SectionPanel>
      </div>
    </main>
  );
}

function TokenStrip({
  label,
  kind,
  filled,
  total,
}: {
  label: string;
  kind: "clue" | "fuse";
  filled: number;
  total: number;
}) {
  return (
    <div className={`hanabi-token-strip hanabi-token-strip--${kind}`}>
      <span className="hanabi-token-label">
        {label} {filled}/{total}
      </span>
      <div className="hanabi-tokens" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={
              index < filled ? "hanabi-token is-filled" : "hanabi-token"
            }
          />
        ))}
      </div>
    </div>
  );
}

function DeckPile({ count }: { count: number }) {
  return (
    <div className="hanabi-deck" aria-label={`Deck ${count} cards`}>
      <div className="hanabi-deck-stack">
        <span className="hanabi-deck-layer" />
        <span className="hanabi-deck-layer" />
        <span className="hanabi-deck-face">
          <span className="hanabi-deck-pattern" />
        </span>
      </div>
      <span className="hanabi-deck-count">{count}</span>
    </div>
  );
}

function HandFan({
  children,
  size = "md",
  emphasized = false,
}: {
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  emphasized?: boolean;
}) {
  return (
    <div
      className={[
        "hanabi-fan",
        `hanabi-fan--${size}`,
        emphasized ? "hanabi-fan--emphasized" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

function FaceCard({
  color,
  rank,
  knowledge,
  size = "md",
  stack = false,
  previewMatch = false,
  previewMiss = false,
}: {
  color: HanabiColor;
  rank: HanabiRank;
  knowledge?: HanabiKnowledge;
  size?: "sm" | "md" | "lg";
  stack?: boolean;
  previewMatch?: boolean;
  previewMiss?: boolean;
}) {
  return (
    <div
      className={[
        "hanabi-card",
        "hanabi-face",
        `hanabi-face--${color}`,
        `hanabi-card--${size}`,
        stack ? "hanabi-card--stack" : "",
        previewMatch ? "is-preview-match" : "",
        previewMiss ? "is-preview-miss" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`${COLOR_LABEL[color]} ${rank}`}
    >
      <div className="hanabi-face-layout">
        <div className="hanabi-face__body">
          <span className="hanabi-face__rank-corner" aria-hidden="true">
            {rank}
          </span>
          <span className="hanabi-face__rank">{rank}</span>
          <span className="hanabi-face__color">{COLOR_LABEL[color]}</span>
          <span className="hanabi-face__pips" aria-hidden="true">
            {Array.from({ length: rank }, (_, index) => (
              <span key={index} className="hanabi-pip" />
            ))}
          </span>
          {knowledge && hasAnyKnowledge(knowledge) ? (
            <span className="hanabi-face__marks" aria-hidden="true">
              {knowledge.knownColor || knowledge.knownRank ? "★" : "·"}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Own-hand card back — never receives or renders color/rank identity or cardId. */
function BackCard({
  position,
  knowledge,
  selectable,
  selected,
  onSelect,
}: {
  position: number;
  knowledge: HanabiKnowledge;
  selectable: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const known = hasAnyKnowledge(knowledge);
  const className = [
    "hanabi-card",
    "hanabi-back",
    "hanabi-card--lg",
    selectable ? "is-selectable" : "",
    selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      <span className="hanabi-back-pattern" aria-hidden="true" />
      {known ? (
        <KnowledgeMarks knowledge={knowledge} />
      ) : (
        <span className="hanabi-back-unknown">?</span>
      )}
    </>
  );

  if (selectable) {
    return (
      <button
        type="button"
        className={className}
        onClick={onSelect}
        aria-label={`Hand card ${position}${selected ? ", selected" : ""}`}
        aria-pressed={selected}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={className} aria-label={`Hand card ${position}`}>
      {body}
    </div>
  );
}

function KnowledgeMarks({ knowledge }: { knowledge: HanabiKnowledge }) {
  return (
    <div className="hanabi-knowledge">
      {knowledge.knownColor ? (
        <span
          className={`hanabi-know-chip hanabi-know-chip--known hanabi-face--${knowledge.knownColor}`}
        >
          {COLOR_LABEL[knowledge.knownColor]} ✓
        </span>
      ) : null}
      {knowledge.knownRank ? (
        <span className="hanabi-know-chip hanabi-know-chip--known hanabi-know-rank">
          {knowledge.knownRank}
        </span>
      ) : null}
      {knowledge.notColors.length > 0 ? (
        <div className="hanabi-know-row" aria-label="Ruled out colors">
          {knowledge.notColors.map((color) => (
            <span
              key={color}
              className={`hanabi-know-pip hanabi-know-pip--out hanabi-face--${color}`}
              title={`Not ${COLOR_LABEL[color]}`}
            />
          ))}
        </div>
      ) : null}
      {knowledge.notRanks.length > 0 ? (
        <div className="hanabi-know-row" aria-label="Ruled out ranks">
          {knowledge.notRanks.map((rank) => (
            <span key={rank} className="hanabi-know-rank-out">
              {rank}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
