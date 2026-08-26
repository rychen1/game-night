type WaitingStatusProps = {
  message: string;
  className?: string;
};

/**
 * Shared waiting / loading copy presentation.
 * Games may pass more specific messages; keep language consistent.
 */
export function WaitingStatus({ message, className }: WaitingStatusProps) {
  return (
    <p
      className={["waiting-status", "status", className]
        .filter(Boolean)
        .join(" ")}
      role="status"
    >
      {message}
    </p>
  );
}
