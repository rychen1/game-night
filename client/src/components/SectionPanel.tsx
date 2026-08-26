import type { ReactNode } from "react";

type SectionPanelProps = {
  children: ReactNode;
  className?: string;
  /** Stronger visual weight for “what’s happening now” / your action / results */
  emphasis?: boolean;
  /** Optional accessible heading association */
  "aria-label"?: string;
};

/**
 * Major conceptual section on the page.
 * Use for top-level concepts only — avoid nesting SectionPanels.
 */
export function SectionPanel({
  children,
  className,
  emphasis = false,
  "aria-label": ariaLabel,
}: SectionPanelProps) {
  return (
    <section
      className={[
        "panel",
        "section-panel",
        emphasis ? "section-panel--emphasis" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={ariaLabel}
    >
      {children}
    </section>
  );
}
