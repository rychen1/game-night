import { useState } from "react";
import type {
  GameAction,
  PictionaryPrivateState,
  PictionaryPublicState,
  PublicPlayer,
  RoomStatePayload,
  StrokePoint,
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

type PictionaryScreenProps = {
  playerId: string;
  name: string;
  room: RoomStatePayload;
  game: PictionaryPublicState;
  privateState: PictionaryPrivateState | null;
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

export function PictionaryScreen({
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
}: PictionaryScreenProps) {
  const [guess, setGuess] = useState("");
  const isHost = room.hostPlayerId === playerId;
  const isDrawer = privateState?.role === "drawer";
  const canDraw = privateState?.legalActions.includes("submit_stroke") ?? false;
  const canGuess = privateState?.legalActions.includes("submit_guess") ?? false;
  const drawerName = game.drawerId
    ? playerName(room.players, game.drawerId)
    : "Unknown";

  function handleStroke(points: StrokePoint[]): void {
    onGameAction({ type: "submit_stroke", points });
  }

  return (
    <main className="page">
      <h1>Pictionary</h1>
      <p className="lede">
        Room <span className="room-code">{room.roomCode}</span>
        {game.phase === "DRAWING"
          ? ` — ${drawerName} is drawing · round ${game.round} of ${game.totalRounds}`
          : game.phase === "RESULTS"
            ? " — results"
            : " — aborted"}
      </p>

      <div className="game-stack game-stack--wide">
        <SectionPanel aria-label="How to play">
          <HowToPlay gameId="pictionary" />
        </SectionPanel>

        {game.phase === "DRAWING" || game.lastRound ? (
          <SectionPanel
            emphasis={game.phase === "DRAWING"}
            aria-label="Current situation"
          >
            {game.lastRound ? (
              <p>
                Last round: {playerName(room.players, game.lastRound.solverId)}{" "}
                guessed <strong>{game.lastRound.word}</strong>
                {game.phase === "DRAWING" ? " — new word in play." : ""}
              </p>
            ) : null}

            {game.phase === "DRAWING" ? (
              <>
                <TurnStatus
                  active={isDrawer ? "you" : "other"}
                  title={isDrawer ? "Your turn" : `${drawerName}'s turn`}
                  detail={
                    isDrawer
                      ? "Draw the word — others are guessing."
                      : `${drawerName} is drawing — guess the word.`
                  }
                  timer={<PhaseTimer endsAt={game.endsAt} />}
                />
                {isDrawer && privateState?.word ? (
                  <p>
                    Your word: <strong>{privateState.word}</strong>
                  </p>
                ) : (
                  <p>
                    Guess the word. You will not see it until someone is correct.
                  </p>
                )}
                <DrawingCanvas
                  strokes={game.strokes}
                  enabled={canDraw}
                  playerId={playerId}
                  onStroke={handleStroke}
                />
                <div className="game-box">
                  <h2>Guesses</h2>
                  {game.guesses.length === 0 ? (
                    <p className="status">No guesses yet.</p>
                  ) : (
                    <ul className="player-list">
                      {game.guesses.map((entry, index) => (
                        <li key={`${entry.playerId}-${index}`}>
                          <span>
                            {playerName(room.players, entry.playerId)}:{" "}
                            {entry.text}
                          </span>
                          {entry.correct ? (
                            <em className="ok">correct</em>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  {canGuess ? (
                    <GameActionArea label="Your action">
                      <form
                        className="inline"
                        onSubmit={(event) => {
                          event.preventDefault();
                          onGameAction({ type: "submit_guess", text: guess });
                          setGuess("");
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
                        <button type="submit">Guess</button>
                      </form>
                    </GameActionArea>
                  ) : null}
                </div>
              </>
            ) : null}
          </SectionPanel>
        ) : null}

        {game.phase === "DRAWING" ? (
          <SectionPanel aria-label="History">
            <details className="pictionary-history">
              <summary>
                History ({game.guesses.length}
                {game.lastRound ? " + last round" : ""})
              </summary>
              <ul className="pictionary-history__list">
                <li>
                  {drawerName} is drawing · round {game.round} of{" "}
                  {game.totalRounds}
                  {game.strokes.length > 0
                    ? ` · ${game.strokes.length} stroke${game.strokes.length === 1 ? "" : "s"}`
                    : ""}
                </li>
                {game.lastRound ? (
                  <li>
                    Last round:{" "}
                    {playerName(room.players, game.lastRound.solverId)} guessed{" "}
                    <strong>{game.lastRound.word}</strong>
                  </li>
                ) : null}
                {game.guesses.map((entry, index) => (
                  <li key={`hist-guess-${index}`}>
                    {playerName(room.players, entry.playerId)}: {entry.text}
                    {entry.correct ? " (correct)" : ""}
                  </li>
                ))}
              </ul>
            </details>
          </SectionPanel>
        ) : null}

        {game.phase === "ABORTED" ? (
          <SectionPanel emphasis aria-label="Results">
            <GameResultsShell
              className="pictionary-review"
              heading="Game complete"
              outcome={<p>The game was aborted because a player left.</p>}
            />
          </SectionPanel>
        ) : null}

        {game.phase === "RESULTS" && game.history ? (
          <SectionPanel emphasis aria-label="Results">
            <GameResultsShell
              className="pictionary-review"
              heading="Game complete"
              outcome={
                <p className="pictionary-review__lede">
                  A gallery of every completed round.
                </p>
              }
              reviewHeading="Review"
            >
              <div className="pictionary-review__gallery">
                {game.history.map((round, index) => (
                  <article
                    key={`${round.drawerId}-${index}`}
                    className="pictionary-review__round"
                  >
                    <h3 className="pictionary-review__round-title">
                      Round {index + 1}:{" "}
                      {playerName(room.players, round.drawerId)} drew{" "}
                      <strong>{round.word}</strong>
                    </h3>
                    <p className="status">
                      Guessed by {playerName(room.players, round.solverId)}
                    </p>
                    <DrawingCanvas
                      strokes={round.strokes}
                      enabled={false}
                      playerId={playerId}
                      onStroke={() => undefined}
                    />
                    {round.guesses.length > 0 ? (
                      <ul className="pictionary-review__guesses">
                        {round.guesses.map((entry, guessIndex) => (
                          <li key={`${entry.playerId}-${guessIndex}`}>
                            {playerName(room.players, entry.playerId)}:{" "}
                            {entry.text}
                            {entry.correct ? (
                              <em className="ok"> correct</em>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>
            </GameResultsShell>
          </SectionPanel>
        ) : null}

        {game.phase === "RESULTS" && !game.history ? (
          <SectionPanel emphasis aria-label="Results">
            <GameResultsShell
              className="pictionary-review"
              heading="Game complete"
              outcome={<p>The round is over.</p>}
            />
          </SectionPanel>
        ) : null}

        {game.phase === "RESULTS" || game.phase === "ABORTED" ? (
          <SectionPanel aria-label="Players" emphasis>
            <GameOverActions
              gameId="pictionary"
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
              game.drawerId === player.id && game.phase === "DRAWING" ? (
                <em>drawing</em>
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
