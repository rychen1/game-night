type ActionFeedbackProps = {
  message: string | null | undefined;
  className?: string;
};

/**
 * Shared presentation for server-rejected / invalid actions.
 * Does not change validation — display only.
 */
export function ActionFeedback({ message, className }: ActionFeedbackProps) {
  if (!message) {
    return null;
  }

  return (
    <p
      className={["action-feedback", "error", className]
        .filter(Boolean)
        .join(" ")}
      role="alert"
    >
      {message}
    </p>
  );
}
