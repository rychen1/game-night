import type { RoomVisibility } from "../network/messages.ts";

type RoomVisibilityFieldsProps = {
  visibility: RoomVisibility;
  password: string;
  onVisibilityChange: (visibility: RoomVisibility) => void;
  onPasswordChange: (password: string) => void;
  /** Form field name for radio group uniqueness when multiple forms exist */
  name?: string;
};

/**
 * Room-level visibility controls (not game configuration).
 * Public/Private behavior is unchanged — presentation only.
 */
export function RoomVisibilityFields({
  visibility,
  password,
  onVisibilityChange,
  onPasswordChange,
  name = "room-visibility",
}: RoomVisibilityFieldsProps) {
  return (
    <div className="room-visibility">
      <h3 className="room-visibility__heading">Room visibility</h3>
      <div
        className="room-visibility__options"
        role="radiogroup"
        aria-label="Room visibility"
      >
        <label className="radio-row">
          <input
            type="radio"
            name={name}
            checked={visibility === "public"}
            onChange={() => onVisibilityChange("public")}
          />
          Public
        </label>
        <label className="radio-row">
          <input
            type="radio"
            name={name}
            checked={visibility === "private"}
            onChange={() => onVisibilityChange("private")}
          />
          Private
        </label>
      </div>
      <p className="room-visibility__hint status">
        {visibility === "public"
          ? "Public rooms appear in Browse Rooms."
          : "Private rooms are not listed and require the room password to join."}
      </p>
      {visibility === "private" ? (
        <label className="room-visibility__password">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            maxLength={64}
            autoComplete="new-password"
          />
        </label>
      ) : null}
    </div>
  );
}
