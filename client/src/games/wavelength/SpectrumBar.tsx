import type { WavelengthGuess } from "../../network/messages.ts";

export type SpectrumMarker = {
  id: string;
  position: number;
  label?: string;
  variant?: "target" | "guess" | "self";
};

type SpectrumBarProps = {
  leftLabel: string;
  rightLabel: string;
  markers?: SpectrumMarker[];
  selectedPosition?: number | null;
  interactive?: boolean;
  onSelect?: (position: number) => void;
  ariaLabel?: string;
};

function clampPosition(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function positionFromPointer(
  clientX: number,
  rect: DOMRect,
): number {
  if (rect.width <= 0) {
    return 0;
  }
  const ratio = (clientX - rect.left) / rect.width;
  return clampPosition(ratio * 100);
}

export function SpectrumBar({
  leftLabel,
  rightLabel,
  markers = [],
  selectedPosition = null,
  interactive = false,
  onSelect,
  ariaLabel = "Spectrum",
}: SpectrumBarProps) {
  function handlePointer(clientX: number, currentTarget: HTMLElement): void {
    if (!interactive || !onSelect) {
      return;
    }
    const track = currentTarget.querySelector<HTMLElement>(
      ".wavelength-spectrum__track",
    );
    if (!track) {
      return;
    }
    onSelect(positionFromPointer(clientX, track.getBoundingClientRect()));
  }

  const displayMarkers = [...markers];
  if (
    selectedPosition !== null &&
    !displayMarkers.some((marker) => marker.variant === "self")
  ) {
    displayMarkers.push({
      id: "self-draft",
      position: selectedPosition,
      label: "Your guess",
      variant: "self",
    });
  }

  return (
    <div className="wavelength-spectrum">
      <div className="wavelength-spectrum__labels">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div
        className={[
          "wavelength-spectrum__interactive",
          interactive ? "is-interactive" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role={interactive ? "slider" : undefined}
        aria-label={ariaLabel}
        aria-valuemin={interactive ? 0 : undefined}
        aria-valuemax={interactive ? 100 : undefined}
        aria-valuenow={
          interactive && selectedPosition !== null ? selectedPosition : undefined
        }
        tabIndex={interactive ? 0 : undefined}
        onClick={(event) => handlePointer(event.clientX, event.currentTarget)}
        onKeyDown={(event) => {
          if (!interactive || !onSelect || selectedPosition === null) {
            return;
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            onSelect(clampPosition(selectedPosition - 5));
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            onSelect(clampPosition(selectedPosition + 5));
          }
        }}
      >
        <div className="wavelength-spectrum__track">
          {displayMarkers.map((marker) => (
            <span
              key={marker.id}
              className={[
                "wavelength-spectrum__marker",
                marker.variant ? `wavelength-spectrum__marker--${marker.variant}` : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ left: `${marker.position}%` }}
              title={marker.label}
            >
              <span className="wavelength-spectrum__marker-pin" aria-hidden="true" />
              {marker.label ? (
                <span className="wavelength-spectrum__marker-label">
                  {marker.label}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function markersFromRound(
  round: {
    target: number;
    guesses: WavelengthGuess[];
  },
  players: { id: string; name: string }[],
  revealTarget = true,
): SpectrumMarker[] {
  const markers: SpectrumMarker[] = [];
  if (revealTarget) {
    markers.push({
      id: "target",
      position: round.target,
      label: "Target",
      variant: "target",
    });
  }
  for (const guess of round.guesses) {
    const name =
      players.find((player) => player.id === guess.playerId)?.name ?? "Player";
    markers.push({
      id: guess.playerId,
      position: guess.position,
      label: name,
      variant: "guess",
    });
  }
  return markers;
}
