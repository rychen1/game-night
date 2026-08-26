import { useCallback, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { buildRoomShareUrl } from "../room/roomShare.ts";

type RoomShareSectionProps = {
  roomCode: string;
};

export function RoomShareSection({ roomCode }: RoomShareSectionProps) {
  const shareUrl = useMemo(
    () => buildRoomShareUrl(roomCode, window.location.origin),
    [roomCode],
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  }, [shareUrl]);

  const copyLabel =
    copyState === "copied"
      ? "Copied!"
      : copyState === "failed"
        ? "Copy failed"
        : "Copy link";

  return (
    <section className="room-share" aria-label="Share room">
      <div className="room-share__qr" aria-hidden="true">
        <QRCode value={shareUrl} size={120} />
      </div>
      <div className="room-share__actions">
        <p className="room-share__hint">
          Scan the code or copy the link so friends can join this room.
        </p>
        <button type="button" className="secondary" onClick={handleCopyLink}>
          {copyLabel}
        </button>
      </div>
    </section>
  );
}
