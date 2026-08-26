import { useState } from "react";
import type {
  FakeArtistPrivateState,
  FakeArtistPublicState,
  GameAction,
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
import { WaitingStatus } from "../../components/WaitingStatus.tsx";

type FakeArtistScreenProps = {
  playerId: string;
  name: string;
  room: RoomStatePayload;
  game: FakeArtistPublicState;
  privateState: FakeArtistPrivateState | null;
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

export function FakeArtistScreen({
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
}: FakeArtistScreenProps) {
  const [guess, setGuess] = useState("");
  const isHost = room.hostPlayerId === playerId;
  const isGameOver = game.phase === "RESULTS" || game.phase === "ABORTED";
  const canDraw = privateState?.legalActions.includes("submit_stroke") ?? false;
  const canVote = privateState?.legalActions.includes("vote") ?? false;
  const canGuess = privateState?.legalActions.includes("guess_word") ?? false;
  const currentName = game.currentPlayerId
    ? playerName(room.players, game.currentPlayerId)
    : null;
  const isActivePlay =
    game.phase === "DRAWING" ||
    game.phase === "VOTING" ||
    game.phase === "GUESS";

  function handleStroke(points: StrokePoint[]): void {
    onGameAction({ type: "submit_stroke", points });
  }

  return (
    <main className="page">
      <h1>Fake Artist</h1>
      <p className="lede">
        Room <span className="room-code">{room.roomCode}</span>
        {" — "}
        {game.phase.toLowerCase()}
        {game.phase === "DRAWING" ? ` · round ${game.round}` : ""}
      </p>

      <div className="game-stack game-stack--wide">
        <SectionPanel aria-label="How to play">
          <HowToPlay gameId="fakeArtist" />
        </SectionPanel>

        <SectionPanel
          emphasis={isActivePlay}
          aria-label="Current situation"
        >
          <p>
            Category: <strong>{game.category}</strong>
          </p>
          {privateState?.role === "fakeArtist" ? (
            <p>You are the Fake Artist. You only know the category.</p>
          ) : privateState?.word ? (
            <p>
              Title: <strong>{privateState.word}</strong>
            </p>
          ) : null}

          {game.phase === "DRAWING" ? (
            <TurnStatus
              active={game.currentPlayerId === playerId ? "you" : "other"}
              title={
                game.currentPlayerId === playerId
                  ? "Your turn"
                  : currentName
                    ? `${currentName}'s turn`
                    : "Drawing phase"
              }
              detail={
                game.currentPlayerId === playerId
                  ? "Draw one stroke."
                  : currentName
                    ? `Waiting for ${currentName}…`
                    : "Waiting…"
              }
              timer={<PhaseTimer endsAt={game.endsAt} />}
            />
          ) : null}

          {isActivePlay ? (
            <DrawingCanvas
              strokes={game.strokes}
              enabled={canDraw}
              playerId={playerId}
              onStroke={handleStroke}
            />
          ) : null}
        </SectionPanel>

        {isActivePlay ? (
          <SectionPanel aria-label="History">
            <details className="fake-artist-history">
              <summary>
                History (
                {game.strokes.length}
                {game.phase === "VOTING" || game.phase === "GUESS"
                  ? ` · ${game.votedPlayerIds.length} voted`
                  : ""}
                )
              </summary>
              <ul className="fake-artist-history__list">
                {game.strokes.map((stroke, index) => (
                  <li key={`stroke-${index}`}>
                    {playerName(room.players, stroke.playerId)} drew a stroke
                  </li>
                ))}
                {game.phase === "VOTING" || game.phase === "GUESS" ? (
                  <>
                    <li>Players voting for the Fake Artist…</li>
                    {room.players.map((player) => (
                      <li key={`vote-status-${player.id}`}>
                        {player.name}:{" "}
                        {game.votedPlayerIds.includes(player.id)
                          ? "voted"
                          : "waiting"}
                      </li>
                    ))}
                  </>
                ) : null}
                {game.phase === "GUESS" ? (
                  <li>Fake Artist is guessing the title…</li>
                ) : null}
              </ul>
            </details>
          </SectionPanel>
        ) : null}

        {game.phase === "VOTING" ? (
          <SectionPanel emphasis={canVote} aria-label="Vote">
            <GameActionArea label="Your action">
              <div className="game-box">
                <h2>Vote for the Fake Artist</h2>
                {canVote ? (
                  <div className="vote-row">
                    {room.players
                      .filter((player) => player.id !== playerId)
                      .map((player) => (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() =>
                            onGameAction({
                              type: "vote",
                              targetPlayerId: player.id,
                            })
                          }
                        >
                          {player.name}
                        </button>
                      ))}
                  </div>
                ) : (
                  <WaitingStatus message="Vote submitted. Waiting for others…" />
                )}
              </div>
            </GameActionArea>
          </SectionPanel>
        ) : null}

        {game.phase === "GUESS" ? (
          <SectionPanel emphasis={canGuess} aria-label="Guess">
            <GameActionArea label="Your action">
              <div className="game-box">
                <h2>The Fake Artist was accused</h2>
                {canGuess ? (
                  <form
                    className="inline"
                    onSubmit={(event) => {
                      event.preventDefault();
                      onGameAction({ type: "guess_word", word: guess });
                    }}
                  >
                    <label>
                      Guess the title
                      <input
                        value={guess}
                        onChange={(event) => setGuess(event.target.value)}
                        maxLength={40}
                      />
                    </label>
                    <button type="submit">Guess</button>
                  </form>
                ) : (
                  <WaitingStatus message="Waiting for the Fake Artist to guess…" />
                )}
              </div>
            </GameActionArea>
          </SectionPanel>
        ) : null}

        {game.phase === "RESULTS" || game.phase === "ABORTED" ? (
          <SectionPanel emphasis aria-label="Results">
            <GameResultsShell
              className="fake-artist-review"
              heading="Game complete"
              outcome={
                <>
                  <p>
                    {game.winner === "fakeArtist"
                      ? "The Fake Artist wins."
                      : game.winner === "artists"
                        ? "The artists win."
                        : "The round was aborted."}
                  </p>
                  <p className="fake-artist-review__reveal">
                    Title was <strong>{game.word}</strong>. Fake Artist was{" "}
                    <strong>
                      {game.fakeArtistId
                        ? playerName(room.players, game.fakeArtistId)
                        : "unknown"}
                    </strong>
                    .
                  </p>
                </>
              }
              reviewHeading="Review"
            >
              <div className="fake-artist-review__section">
                <h3 className="fake-artist-review__section-title">
                  Completed drawing
                </h3>
                <DrawingCanvas
                  strokes={game.strokes}
                  enabled={false}
                  playerId={playerId}
                  onStroke={() => undefined}
                />
              </div>

              {game.votes && game.votes.length > 0 ? (
                <div className="fake-artist-review__section">
                  <h3 className="fake-artist-review__section-title">
                    Accusations
                  </h3>
                  <ul className="fake-artist-review__list">
                    {game.votes.map((vote) => (
                      <li key={vote.voterId}>
                        {playerName(room.players, vote.voterId)} voted for{" "}
                        {playerName(room.players, vote.targetPlayerId)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="fake-artist-review__section">
                <h3 className="fake-artist-review__section-title">Timeline</h3>
                <ol className="fake-artist-review__list">
                  {game.strokes.map((stroke, index) => (
                    <li key={`review-stroke-${index}`}>
                      {playerName(room.players, stroke.playerId)} drew a stroke
                    </li>
                  ))}
                  {game.votes && game.votes.length > 0 ? (
                    <li>Players voted for the Fake Artist</li>
                  ) : null}
                  {game.votes?.map((vote) => (
                    <li key={`review-vote-${vote.voterId}`}>
                      {playerName(room.players, vote.voterId)} accused{" "}
                      {playerName(room.players, vote.targetPlayerId)}
                    </li>
                  ))}
                  {game.word ? (
                    <li>
                      Revealed: title “{game.word}”, Fake Artist{" "}
                      {game.fakeArtistId
                        ? playerName(room.players, game.fakeArtistId)
                        : "unknown"}
                    </li>
                  ) : null}
                </ol>
              </div>
            </GameResultsShell>
          </SectionPanel>
        ) : null}

        {game.phase === "RESULTS" || game.phase === "ABORTED" ? (
          <SectionPanel aria-label="Players" emphasis>
            <GameOverActions
              gameId="fakeArtist"
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
              renderExtraTags={(player) => (
                <>
                  {game.currentPlayerId === player.id &&
                  game.phase === "DRAWING" ? (
                    <em>drawing</em>
                  ) : null}
                  {game.votedPlayerIds.includes(player.id) ? (
                    <em>voted</em>
                  ) : null}
                </>
              )}
            />
          ) : null}

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
