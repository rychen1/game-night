import { useCallback, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { roomShareInvitationUrl } from "../room/roomShare.ts";

type RoomShareSectionProps = {
  roomCode: string;
};

export function RoomShareSection({ roomCode }: RoomShareSectionProps) {
  const shareUrl = useMemo(
    () => roomShareInvitationUrl(roomCode),
    [roomCode],
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  const handleCopyLink = useCallback(async () => {
    if (shareUrl === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  }, [shareUrl]);

  if (shareUrl === null) {
    return null;
  }

  const copyLabel =
    copyState === "copied"
      ? "Copied!"
      : copyState === "failed"
        ? "Copy failed"
        : "Copy link";

  return (
    <div className="room-share">
      <div className="room-share__qr">
        <QRCode
          value={shareUrl}
          size={128}
          level="M"
          title={`Join room ${roomCode}`}
        />
      </div>
      <div className="room-share__details">
        <p className="room-share__hint">
          Scan the code or copy the link so friends can join this room.
        </p>
        <p className="room-share__url">
          <span className="visually-hidden">Invitation link</span>
          <code>{shareUrl}</code>
        </p>
        <button type="button" className="secondary" onClick={handleCopyLink}>
          {copyLabel}
        </button>
      </div>
    </div>
  );
}
