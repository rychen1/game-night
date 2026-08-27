import type {
  GameSettings,
  GameSetupView,
  GangMode,
  TheGangSettings,
} from "../../network/messages.ts";
import type { GameInfoConfiguration } from "../../components/GameInfo.tsx";

export function configurationForSetup(setup: GameSetupView): GameInfoConfiguration {
  if (setup.settings.kind === "theGang") {
    return configurationForGangMode(setup.settings.mode, setup.fields);
  }
  return { label: "Standard" };
}

export function configurationForGameId(gameId: string): GameInfoConfiguration {
  if (gameId === "theGang") {
    return { label: "Basic", detail: "Default lobby mode" };
  }
  return { label: "Standard" };
}

function configurationForGangMode(
  mode: GangMode,
  fields: GameSetupView["fields"],
): GameInfoConfiguration {
  const modeField = fields.find(
    (field) => field.key === "mode" && field.type === "select",
  );
  const detailByMode: Partial<Record<GangMode, string>> = {
    basic: "No challenge or specialist cards",
    advanced: "Draw a challenge after each successful heist, or a specialist after each failure",
    professional:
      "One permanent challenge plus Advanced-style rotating cards (Quick Access excluded)",
    masterThief:
      "Two active challenges rotate each heist; lose on 2 alarms; no specialists",
  };
  if (modeField?.type === "select") {
    const option = modeField.options.find((entry) => entry.value === mode);
    if (option) {
      return { label: option.label, detail: detailByMode[mode] };
    }
  }
  return { label: mode, detail: detailByMode[mode] };
}

export function updateSetupSettings(
  setup: GameSetupView,
  key: string,
  value: string,
): GameSettings | null {
  if (setup.settings.kind === "theGang" && key === "mode") {
    const mode = value as GangMode;
    if (
      mode === "basic" ||
      mode === "advanced" ||
      mode === "professional" ||
      mode === "masterThief"
    ) {
      const next: TheGangSettings = { kind: "theGang", mode };
      return next;
    }
  }
  return null;
}

export function gangModeLabel(mode: GangMode): string {
  switch (mode) {
    case "basic":
      return "Basic";
    case "advanced":
      return "Advanced";
    case "professional":
      return "Professional";
    case "masterThief":
      return "Master Thief";
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}
