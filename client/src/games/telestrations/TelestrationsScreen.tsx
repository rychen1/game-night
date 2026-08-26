import { useEffect, useState } from "react";
import type {
  GameAction,
  PublicPlayer,
  RoomStatePayload,
  Stroke,
  StrokePoint,
  TelestrationsPrivateState,
  TelestrationsPublicState,
} from "../../network/messages.ts";
import { DrawingCanvas } from "../drawing/DrawingCanvas.tsx";
import { PhaseTimer } from "../PhaseTimer.tsx";
import { ActionFeedback } from "../../components/ActionFeedback.tsx";
import { GameActionArea } from "../../components/GameActionArea.tsx";
import { GameOverActions } from "../../components/GameOverActions.tsx";
import { GamePlayerList } from "../../components/GamePlayerList.tsx";
import { GameResultsShell } from "../../components/GameResultsShell.tsx";
import { HowToPlay } from "../../components/HowToPlay.tsx";
import { SectionPanel } from "../../components/SectionPanel.tsx";
import { TurnStatus } from "../../components/TurnStatus.tsx";
import { WaitingStatus } from "../../components/WaitingStatus.tsx";

type TelestrationsScreenProps = {
  playerId: string;
  name: string;
  room: RoomStatePayload;
  game: TelestrationsPublicState;
  privateState: TelestrationsPrivateState | null;
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

export function TelestrationsScreen({
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
}: TelestrationsScreenProps) {
  const [draft, setDraft] = useState<Stroke[]>([]);
  const [guess, setGuess] = useState("");
  const isHost = room.hostPlayerId === playerId;
  const canDraw = privateState?.legalActions.includes("submit_drawing") ?? false;
  const canGuess = privateState?.legalActions.includes("submit_guess") ?? false;
  const isActivePlay =
    game.phase === "DRAWING" || game.phase === "GUESSING";

  useEffect(() => {
    setDraft([]);
    setGuess("");
  }, [game.round, game.phase]);

  function handleStroke(points: StrokePoint[]): void {
    setDraft((current) => [...current, { playerId, points }]);
  }

  return (
    <main className="page">
      <h1>Telestrations</h1>
      <p className="lede">
        Room <span className="room-code">{room.roomCode}</span>
        {" — "}
        {game.phase.toLowerCase()}
        {game.phase === "DRAWING" || game.phase === "GUESSING"
          ? ` · round ${game.round + 1} of ${game.totalRounds}`
          : ""}
      </p>

      <div className="game-stack game-stack--wide">
        <SectionPanel aria-label="How to play">
          <HowToPlay gameId="telestrations" />
        </SectionPanel>

        {isActivePlay ||
        privateState?.task === "draw" ||
        privateState?.task === "guess" ? (
          <SectionPanel
            emphasis={isActivePlay}
            aria-label="Current situation"
          >
            {isActivePlay ? (
              <TurnStatus
                active="phase"
                title={
                  game.phase === "DRAWING" ? "Drawing phase" : "Guessing phase"
                }
                detail={`${game.submittedPlayerIds.length}/${room.players.length} submitted`}
                timer={<PhaseTimer endsAt={game.endsAt} />}
              />
            ) : null}

            {privateState?.task === "draw" ? (
              <div className="game-box">
                <h2>Draw</h2>
                <p>
                  {privateState.promptText
                    ? `Prompt: ${privateState.promptText}`
                    : `Guess to draw: ${privateState.guessText ?? ""}`}
                </p>
                <DrawingCanvas
                  strokes={draft}
                  enabled={canDraw}
                  playerId={playerId}
                  onStroke={handleStroke}
                />
                {canDraw ? (
                  <GameActionArea label="Your action">
                    <div className="vote-row">
                      <button
                        type="button"
                        className="secondary"
                        disabled={draft.length === 0}
                        onClick={() =>
                          setDraft((current) => current.slice(0, -1))
                        }
                      >
                        Undo
                      </button>
                      <button
                        type="button"
                        disabled={draft.length === 0}
                        onClick={() =>
                          onGameAction({
                            type: "submit_drawing",
                            strokes: draft,
                          })
                        }
                      >
                        Submit drawing
                      </button>
                    </div>
                  </GameActionArea>
                ) : (
                  <WaitingStatus message="Waiting for the other players…" />
                )}
              </div>
            ) : null}

            {privateState?.task === "guess" ? (
              <div className="game-box">
                <h2>Guess this drawing</h2>
                <DrawingCanvas
                  strokes={privateState.strokes ?? []}
                  enabled={false}
                  playerId={playerId}
                  onStroke={() => undefined}
                />
                {canGuess ? (
                  <GameActionArea label="Your action">
                    <form
                      className="inline"
                      onSubmit={(event) => {
                        event.preventDefault();
                        onGameAction({ type: "submit_guess", text: guess });
                      }}
                    >
                      <label>
                        Your guess
                        <input
                          value={guess}
                          onChange={(event) => setGuess(event.target.value)}
                          maxLength={40}
                        />
                      </label>
                      <button type="submit">Submit guess</button>
                    </form>
                  </GameActionArea>
                ) : (
                  <WaitingStatus message="Waiting for the other players…" />
                )}
              </div>
            ) : null}
          </SectionPanel>
        ) : null}

        {isActivePlay ? (
          <SectionPanel aria-label="History">
            <details className="telestrations-history">
              <summary>
                History · round {game.round + 1} of {game.totalRounds} (
                {game.submittedPlayerIds.length}/{room.players.length} submitted)
              </summary>
              <ul className="telestrations-history__list">
                <li>
                  Phase: {game.phase === "DRAWING" ? "drawing" : "guessing"}
                </li>
                {room.players.map((player) => {
                  const submitted = game.submittedPlayerIds.includes(player.id);
                  return (
                    <li key={player.id}>
                      {player.name}: {submitted ? "submitted" : "waiting"}
                    </li>
                  );
                })}
              </ul>
            </details>
          </SectionPanel>
        ) : null}

        {game.phase === "ABORTED" ? (
          <SectionPanel emphasis aria-label="Results">
            <GameResultsShell
              className="telestrations-review"
              heading="Game complete"
              outcome={<p>The round was aborted because a player left.</p>}
            />
          </SectionPanel>
        ) : null}

        {game.phase === "REVEAL" && game.books ? (
          <SectionPanel emphasis aria-label="Results">
            <GameResultsShell
              className="telestrations-review"
              heading="Game complete"
              outcome={
                <p className="telestrations-review__lede">
                  Follow each telephone chain from the original prompt through
                  every drawing and guess.
                </p>
              }
              reviewHeading="Review"
            >
              <div className="telestrations-review__gallery">
                {game.books.map((book) => (
                  <article
                    key={book.ownerId}
                    className="telestrations-review__book"
                  >
                    <h3 className="telestrations-review__book-title">
                      Book started by {playerName(room.players, book.ownerId)}
                    </h3>
                    <ol className="telestrations-review__chain">
                      {book.pages.map((page, index) => (
                        <li
                          key={`${book.ownerId}-${index}`}
                          className={`telestrations-review__step telestrations-review__step--${page.kind}`}
                        >
                          <span className="telestrations-review__step-label">
                            {page.kind === "prompt"
                              ? "Original prompt"
                              : page.kind === "drawing"
                                ? "Drawing"
                                : "Guess"}
                          </span>
                          <span className="telestrations-review__step-author">
                            {playerName(room.players, page.authorId)}
                          </span>
                          {page.kind === "prompt" || page.kind === "guess" ? (
                            <p className="telestrations-review__step-text">
                              {page.text}
                            </p>
                          ) : null}
                          {page.kind === "drawing" ? (
                            <DrawingCanvas
                              strokes={page.strokes}
                              enabled={false}
                              playerId={page.authorId}
                              onStroke={() => undefined}
                            />
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            </GameResultsShell>
          </SectionPanel>
        ) : null}

        {game.phase === "REVEAL" && !game.books ? (
          <SectionPanel emphasis aria-label="Results">
            <GameResultsShell
              className="telestrations-review"
              heading="Game complete"
              outcome={<p>The round is over.</p>}
            />
          </SectionPanel>
        ) : null}

        {game.phase === "REVEAL" || game.phase === "ABORTED" ? (
          <SectionPanel aria-label="Players" emphasis>
            <GameOverActions
              gameId="telestrations"
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
          <GamePlayerList
            players={room.players}
            playerId={playerId}
            renderExtraTags={(player) =>
              game.submittedPlayerIds.includes(player.id) ? (
                <em>submitted</em>
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
