import { useState } from "react";
import type {
  GameAction,
  PublicPlayer,
  RoomStatePayload,
  WavelengthPrivateState,
  WavelengthPublicState,
  WavelengthRoundResult,
} from "../../network/messages.ts";
import { ActionFeedback } from "../../components/ActionFeedback.tsx";
import { GameActionArea } from "../../components/GameActionArea.tsx";
import { GameOverActions } from "../../components/GameOverActions.tsx";
import { GamePlayerList } from "../../components/GamePlayerList.tsx";
import { GameResultsShell } from "../../components/GameResultsShell.tsx";
import { HowToPlay } from "../../components/HowToPlay.tsx";
import { SectionPanel } from "../../components/SectionPanel.tsx";
import { TurnStatus } from "../../components/TurnStatus.tsx";
import { WaitingStatus } from "../../components/WaitingStatus.tsx";
import { markersFromRound, SpectrumBar } from "./SpectrumBar.tsx";

type WavelengthScreenProps = {
  playerId: string;
  room: RoomStatePayload;
  game: WavelengthPublicState;
  privateState: WavelengthPrivateState | null;
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

function RoundReview({
  round,
  players,
}: {
  round: WavelengthRoundResult;
  players: PublicPlayer[];
}) {
  return (
    <article className="wavelength-review__round">
      <h3 className="wavelength-review__round-title">
        Round {round.round}: {round.leftLabel} ↔ {round.rightLabel}
      </h3>
      <p className="wavelength-review__clue">
        Clue: <strong>{round.clue}</strong> — from{" "}
        {playerName(players, round.clueGiverId)}
      </p>
      <SpectrumBar
        leftLabel={round.leftLabel}
        rightLabel={round.rightLabel}
        markers={markersFromRound(round, players, true)}
      />
      <ul className="wavelength-review__scores">
        {round.guesses.map((guess) => (
          <li key={guess.playerId}>
            {playerName(players, guess.playerId)} guessed {guess.position} ·{" "}
            {round.guessScores[guess.playerId] ?? 0} pts
          </li>
        ))}
      </ul>
      <p className="status">Round score: {round.roundScore}</p>
    </article>
  );
}

export function WavelengthScreen({
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
}: WavelengthScreenProps) {
  const [clueDraft, setClueDraft] = useState("");
  const [guessDraft, setGuessDraft] = useState<number | null>(50);
  const isHost = room.hostPlayerId === playerId;
  const isGameOver = game.phase === "RESULTS" || game.phase === "ABORTED";
  const isClueGiver = privateState?.role === "clueGiver";
  const canSubmitClue = privateState?.legalActions.includes("submit_clue") ?? false;
  const canSubmitGuess =
    privateState?.legalActions.includes("submit_spectrum_guess") ?? false;
  const hasSubmittedGuess = privateState?.myGuess !== undefined;
  const clueGiverName = playerName(room.players, game.clueGiverId);

  const activeMarkers =
    isClueGiver && privateState?.target !== undefined
      ? [
          {
            id: "target",
            position: privateState.target,
            label: "Target",
            variant: "target" as const,
          },
        ]
      : [];

  return (
    <main className="page">
      <h1>Wavelength</h1>
      <p className="lede">
        Room <span className="room-code">{room.roomCode}</span>
        {isGameOver
          ? game.phase === "RESULTS"
            ? " — results"
            : " — aborted"
          : ` — round ${game.round} of ${game.totalRounds} · team score ${game.totalScore}`}
      </p>

      <div className="game-stack game-stack--wide">
        <SectionPanel aria-label="How to play">
          <HowToPlay gameId="wavelength" />
        </SectionPanel>

        {!isGameOver ? (
          <>
            <SectionPanel emphasis aria-label="Round">
              <TurnStatus
                title={
                  isClueGiver
                    ? "You are the clue-giver"
                    : `${clueGiverName} is the clue-giver`
                }
                detail={
                  game.phase === "CLUE"
                    ? isClueGiver
                      ? "Give a one-word or short clue for the hidden target."
                      : "Waiting for a clue…"
                    : hasSubmittedGuess
                      ? "Guess submitted — waiting for the other players…"
                      : game.clue
                        ? `The clue is “${game.clue}”. Place your guess on the spectrum.`
                        : "Waiting for guesses…"
                }
              />

              <SpectrumBar
                leftLabel={game.leftLabel}
                rightLabel={game.rightLabel}
                markers={activeMarkers}
                selectedPosition={
                  canSubmitGuess
                    ? guessDraft
                    : hasSubmittedGuess
                      ? privateState?.myGuess ?? null
                      : null
                }
                interactive={canSubmitGuess}
                onSelect={setGuessDraft}
              />

              {game.phase === "CLUE" && isClueGiver ? (
                <GameActionArea>
                  <form
                    className="inline wavelength-clue-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!canSubmitClue || clueDraft.trim().length === 0) {
                        return;
                      }
                      onGameAction({ type: "submit_clue", clue: clueDraft.trim() });
                      setClueDraft("");
                    }}
                  >
                    <label>
                      Your clue
                      <input
                        value={clueDraft}
                        onChange={(event) => setClueDraft(event.target.value)}
                        maxLength={40}
                        autoComplete="off"
                      />
                    </label>
                    <button type="submit" disabled={!canSubmitClue}>
                      Submit clue
                    </button>
                  </form>
                </GameActionArea>
              ) : null}

              {game.phase === "GUESSING" && game.clue ? (
                <p className="wavelength-clue-display">
                  Clue: <strong>{game.clue}</strong>
                </p>
              ) : null}

              {canSubmitGuess ? (
                <GameActionArea>
                  <button
                    type="button"
                    disabled={guessDraft === null}
                    onClick={() => {
                      if (guessDraft === null) {
                        return;
                      }
                      onGameAction({
                        type: "submit_spectrum_guess",
                        position: guessDraft,
                      });
                    }}
                  >
                    Submit guess
                  </button>
                </GameActionArea>
              ) : null}

              {game.phase === "GUESSING" &&
              !isClueGiver &&
              !canSubmitGuess &&
              !hasSubmittedGuess ? (
                <WaitingStatus message="Waiting for the clue-giver and other players…" />
              ) : null}

              {game.lastReveal ? (
                <div className="wavelength-last-reveal">
                  <h3 className="wavelength-section-title">Last round reveal</h3>
                  <RoundReview round={game.lastReveal} players={room.players} />
                </div>
              ) : null}
            </SectionPanel>

            <SectionPanel aria-label="Players">
              <GamePlayerList
                players={room.players}
                playerId={playerId}
                renderExtraTags={(player) => {
                  if (player.id === game.clueGiverId) {
                    return <em>clue-giver</em>;
                  }
                  if (game.submittedGuesserIds.includes(player.id)) {
                    return <em>guessed</em>;
                  }
                  return null;
                }}
              />
            </SectionPanel>

            {game.history && game.history.length > 0 ? (
              <SectionPanel aria-label="History">
                <details className="wavelength-history">
                  <summary>History ({game.history.length})</summary>
                  <ul className="wavelength-history__list">
                    {game.history.map((round) => (
                      <li key={`hist-${round.round}`}>
                        Round {round.round}: {round.leftLabel} ↔ {round.rightLabel}{" "}
                        · clue “{round.clue}” · {round.roundScore} pts
                      </li>
                    ))}
                  </ul>
                </details>
              </SectionPanel>
            ) : null}
          </>
        ) : null}

        {game.phase === "ABORTED" ? (
          <SectionPanel emphasis aria-label="Results">
            <GameResultsShell
              className="wavelength-review"
              heading="Game complete"
              outcome={<p>The game was aborted because a player left.</p>}
            />
          </SectionPanel>
        ) : null}

        {game.phase === "RESULTS" && game.history ? (
          <SectionPanel emphasis aria-label="Results">
            <GameResultsShell
              className="wavelength-review"
              heading="Game complete"
              outcome={
                <p className="wavelength-review__lede">
                  Team score: <strong>{game.totalScore}</strong>
                </p>
              }
              scoresHeading="Score"
              scores={[
                {
                  id: "team",
                  name: "Team",
                  value: game.totalScore,
                  highlight: true,
                },
              ]}
              reviewHeading="Review"
            >
              <div className="wavelength-review__gallery">
                {game.history.map((round) => (
                  <RoundReview
                    key={`review-${round.round}`}
                    round={round}
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
              gameId="wavelength"
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
