import type {
  GangCard,
  GangHandCategory,
  GangPrivateState,
  GangPublicState,
  GangRank,
  PublicPlayer,
} from "../../network/messages.ts";
import type { GameAction } from "../../network/messages.ts";
import { SectionPanel } from "../../components/SectionPanel.tsx";
import { WaitingStatus } from "../../components/WaitingStatus.tsx";
import { cardLabel, rankLabel, suitSymbol, isRedSuit } from "./cards.ts";

const HAND_CATEGORIES: { value: GangHandCategory; label: string }[] = [
  { value: "high_card", label: "High card" },
  { value: "pair", label: "Pair" },
  { value: "two_pair", label: "Two pair" },
  { value: "three_kind", label: "Three of a kind" },
  { value: "straight", label: "Straight" },
  { value: "flush", label: "Flush" },
  { value: "full_house", label: "Full house" },
  { value: "four_kind", label: "Four of a kind" },
  { value: "straight_flush", label: "Straight flush" },
  { value: "royal_flush", label: "Royal flush" },
];

const POCKET_RANKS: GangRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

function playerName(players: PublicPlayer[], id: string): string {
  return players.find((player) => player.id === id)?.name ?? "Unknown";
}

function HoleCardButton({
  card,
  index,
  onSelect,
}: {
  card: GangCard;
  index: number;
  onSelect: (index: number) => void;
}) {
  const red = card.suit ? isRedSuit(card.suit) : false;
  return (
    <button type="button" className="gang-modifier-card-btn" onClick={() => onSelect(index)}>
      {card.jackSpecialist ? (
        <span className="gang-card">J*</span>
      ) : (
        <span className={`gang-card${red ? " gang-card--red" : ""}`}>
          <span className="gang-card__rank">{rankLabel(card.rank)}</span>
          <span className="gang-card__suit">{suitSymbol(card.suit!)}</span>
        </span>
      )}
    </button>
  );
}

function specialistLabel(game: GangPublicState, specialistId: string): string {
  const fromActive = game.activeModifiers.find(
    (modifier) => modifier.kind === "specialist" && modifier.id === specialistId,
  );
  return fromActive?.name ?? specialistId;
}

export function GetawayDriverPanel({
  game,
  privateState,
  players,
  playerId,
  onGameAction,
}: {
  game: GangPublicState;
  privateState: GangPrivateState | null;
  players: PublicPlayer[];
  playerId: string;
  onGameAction: (action: GameAction) => void;
}) {
  const legal = privateState?.legalActions ?? [];
  const assigneeId = game.getawayDriverAssigneeId;
  if (!assigneeId) {
    return null;
  }

  const assigneeName = playerName(players, assigneeId);
  const canDeclare = legal.includes("gang_declare_category");
  const isAssignee = assigneeId === playerId;

  return (
    <div className="gang-getaway-panel">
      <p className="status">
        <strong>Getaway Driver:</strong> {assigneeName} must declare their current
        hand category once enough cards are revealed.
      </p>
      {canDeclare ? (
        <div className="gang-setup-actions gang-setup-actions--grid">
          {HAND_CATEGORIES.map((entry) => (
            <button
              key={entry.value}
              type="button"
              className="secondary"
              onClick={() =>
                onGameAction({ type: "gang_declare_category", category: entry.value })
              }
            >
              {entry.label}
            </button>
          ))}
        </div>
      ) : isAssignee ? (
        <p className="status">
          Wait for more community cards before declaring your hand category.
        </p>
      ) : (
        <WaitingStatus message={`Waiting for ${assigneeName} to declare their hand.`} />
      )}
    </div>
  );
}

export function SpecialistSetupPanel({
  game,
  privateState,
  players,
  playerId,
  onGameAction,
}: {
  game: GangPublicState;
  privateState: GangPrivateState | null;
  players: PublicPlayer[];
  playerId: string;
  onGameAction: (action: GameAction) => void;
}) {
  const setup = game.specialistSetup;
  const legal = privateState?.legalActions ?? [];
  if (!setup) {
    return null;
  }

  const specialistName = specialistLabel(game, setup.specialistId);

  return (
    <SectionPanel aria-label="Specialist setup" emphasis>
      <h2 className="gang-section-title">{specialistName}</h2>
      <p className="status">
        Resolve the active specialist before strength positions begin.
        {setup.specialistId === "getawayDriver"
          ? " The Getaway Driver will declare their hand category later, once community cards are out."
          : ""}
      </p>

      {setup.declarations.length > 0 ? (
        <ul className="gang-setup-declarations">
          {setup.declarations.map((entry) => (
            <li key={`${entry.playerId}-${entry.label}`}>
              <strong>{playerName(players, entry.playerId)}</strong>: {entry.label}
            </li>
          ))}
        </ul>
      ) : null}

      {legal.includes("gang_take_specialist") ? (
        <button
          type="button"
          className="primary"
          onClick={() => onGameAction({ type: "gang_take_specialist" })}
        >
          Take this specialist role
        </button>
      ) : null}

      {legal.includes("gang_declare_face_cards") ? (
        <div className="gang-setup-actions">
          {[0, 1, 2].map((count) => (
            <button
              key={`face-${count}`}
              type="button"
              className="secondary"
              onClick={() =>
                onGameAction({ type: "gang_declare_face_cards", count })
              }
            >
              Declare {count} face card{count === 1 ? "" : "s"}
            </button>
          ))}
        </div>
      ) : null}

      {legal.includes("gang_declare_math_sum") && privateState ? (
        <div className="gang-setup-actions">
          <button
            type="button"
            className="primary"
            onClick={() => {
              const sum = privateState.holeCards.reduce((total, card) => {
                if (card.rank >= 11 && card.rank <= 13) {
                  return total + 10;
                }
                if (card.rank === 14) {
                  return total + 11;
                }
                return total + card.rank;
              }, 0);
              onGameAction({ type: "gang_declare_math_sum", sum });
            }}
          >
            Declare sum ({privateState.holeCards.length} cards)
          </button>
        </div>
      ) : null}

      {legal.includes("gang_declare_category") ? (
        <div className="gang-setup-actions gang-setup-actions--grid">
          {HAND_CATEGORIES.map((entry) => (
            <button
              key={entry.value}
              type="button"
              className="secondary"
              onClick={() =>
                onGameAction({ type: "gang_declare_category", category: entry.value })
              }
            >
              {entry.label}
            </button>
          ))}
        </div>
      ) : null}

      {legal.includes("gang_declare_rank_count") ? (
        <div className="gang-setup-actions gang-setup-actions--grid">
          {POCKET_RANKS.map((rank) =>
            [0, 1, 2].map((count) => (
              <button
                key={`${rank}-${count}`}
                type="button"
                className="secondary"
                onClick={() =>
                  onGameAction({ type: "gang_declare_rank_count", rank, count })
                }
              >
                {count} × {rankLabel(rank)}
              </button>
            )),
          )}
        </div>
      ) : null}

      {legal.includes("gang_coordinator_pass") && privateState ? (
        <div className="gang-card-row">
          {privateState.holeCards.map((card, index) => (
            <HoleCardButton
              key={`pass-${cardLabel(card)}-${index}`}
              card={card}
              index={index}
              onSelect={(cardIndex) =>
                onGameAction({ type: "gang_coordinator_pass", cardIndex })
              }
            />
          ))}
        </div>
      ) : null}

      {legal.includes("gang_discard_hole") && privateState ? (
        <div className="gang-card-row">
          {privateState.holeCards.map((card, index) => (
            <HoleCardButton
              key={`discard-${cardLabel(card)}-${index}`}
              card={card}
              index={index}
              onSelect={(cardIndex) =>
                onGameAction({ type: "gang_discard_hole", cardIndex })
              }
            />
          ))}
        </div>
      ) : null}

      {legal.includes("gang_informant") && privateState ? (
        <div className="gang-setup-actions">
          {players
            .filter((player) => player.id !== playerId)
            .flatMap((target) =>
              privateState.holeCards.map((card, index) => (
                <button
                  key={`informant-${target.id}-${index}`}
                  type="button"
                  className="secondary"
                  onClick={() =>
                    onGameAction({
                      type: "gang_informant",
                      targetPlayerId: target.id,
                      cardIndex: index,
                    })
                  }
                >
                  Show {cardLabel(card)} to {target.name}
                </button>
              )),
            )}
        </div>
      ) : null}

      {setup.pendingPlayerIds.length > 0 ? (
        <WaitingStatus
          message={`Waiting for ${setup.pendingPlayerIds
            .map((id) => playerName(players, id))
            .join(", ")}.`}
        />
      ) : null}
    </SectionPanel>
  );
}

export function ShowdownGatePanel({
  game,
  privateState,
  players,
  playerId,
  onGameAction,
}: {
  game: GangPublicState;
  privateState: GangPrivateState | null;
  players: PublicPlayer[];
  playerId: string;
  onGameAction: (action: GameAction) => void;
}) {
  const gate = game.showdownGate;
  const legal = privateState?.legalActions ?? [];
  if (!gate) {
    return null;
  }

  const targetName = playerName(players, gate.targetPlayerId);
  const isTarget = gate.targetPlayerId === playerId;
  const guessers = players.filter((player) => player.id !== gate.targetPlayerId);
  const submittedNames = gate.submittedPlayerIds.map((id) => playerName(players, id));
  const waitingNames = guessers
    .filter((player) => !gate.submittedPlayerIds.includes(player.id))
    .map((player) => player.name);

  return (
    <SectionPanel aria-label="Showdown gate" emphasis>
      <h2 className="gang-section-title">Showdown check</h2>
      <p className="status">
        {gate.kind === "retinaScan"
          ? `Before ${targetName} reveals, agree on a pocket rank they hold.`
          : `Before ${targetName} reveals, agree on their hand category.`}
      </p>
      {submittedNames.length > 0 ? (
        <p className="status">
          Confirmed: {submittedNames.join(", ")} ({submittedNames.length}/
          {guessers.length})
        </p>
      ) : null}
      {waitingNames.length > 0 && !isTarget ? (
        <p className="status">Still guessing: {waitingNames.join(", ")}</p>
      ) : null}
      {gate.agreedRank ? (
        <p className="status">Agreed rank: {rankLabel(gate.agreedRank)}</p>
      ) : null}
      {gate.agreedCategory ? (
        <p className="status">Agreed category: {gate.agreedCategory.replace("_", " ")}</p>
      ) : null}

      {!isTarget && legal.includes("gang_guess_pocket_rank") ? (
        <div className="gang-setup-actions gang-setup-actions--grid">
          {POCKET_RANKS.map((rank) => (
            <button
              key={`rank-guess-${rank}`}
              type="button"
              className="secondary"
              onClick={() => onGameAction({ type: "gang_guess_pocket_rank", rank })}
            >
              {rankLabel(rank)}
            </button>
          ))}
        </div>
      ) : null}

      {!isTarget && legal.includes("gang_guess_hand_category") ? (
        <div className="gang-setup-actions gang-setup-actions--grid">
          {HAND_CATEGORIES.map((entry) => (
            <button
              key={`cat-guess-${entry.value}`}
              type="button"
              className="secondary"
              onClick={() =>
                onGameAction({ type: "gang_guess_hand_category", category: entry.value })
              }
            >
              {entry.label}
            </button>
          ))}
        </div>
      ) : null}

      {isTarget ? (
        <WaitingStatus message="Waiting for the gang to agree on a guess." />
      ) : null}
    </SectionPanel>
  );
}

function InformantTipCard({ card }: { card: GangCard }) {
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

export function InformantCardNotice({
  privateState,
}: {
  privateState: GangPrivateState | null;
}) {
  if (!privateState?.informantCard) {
    return null;
  }
  const card = privateState.informantCard;
  return (
    <SectionPanel aria-label="Informant tip">
      <h2 className="gang-section-title">Informant tip</h2>
      <p className="status">A teammate secretly showed you one card:</p>
      <div className="gang-card-row gang-informant-tip__card">
        <InformantTipCard card={card} />
      </div>
    </SectionPanel>
  );
}
