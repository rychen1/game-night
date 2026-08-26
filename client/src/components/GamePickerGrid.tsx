import type { GameId } from "../network/messages.ts";
import { homeGameCatalog, homeGameGenre } from "../games/catalog.ts";

type GamePickerGridProps = {
  onSelect: (gameId: GameId) => void;
  heading?: string;
  centered?: boolean;
};

export function GamePickerGrid({
  onSelect,
  heading,
  centered = false,
}: GamePickerGridProps) {
  return (
    <section
      className={
        centered
          ? "game-picker-section game-picker-section--centered"
          : "game-picker-section"
      }
    >
      {heading ? <h2 className="game-picker-heading">{heading}</h2> : null}
      <ul className="game-picker-grid">
        {homeGameCatalog().map((game) => {
          const { genre, label } = homeGameGenre(game.id);
          return (
            <li key={game.id} className="game-picker-grid__item">
              <button
                type="button"
                className={`game-card game-card--${genre}`}
                onClick={() => onSelect(game.id)}
              >
                <span className="game-card__genre">{label}</span>
                <span className="game-card__title">{game.title}</span>
                <span className="game-card__description">{game.description}</span>
                <span className="game-card__players">
                  {game.minPlayers}–{game.maxPlayers} players
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
