export function AngleIcon({
  direction = "right",
  className = "",
}: {
  direction?: "up" | "down" | "left" | "right";
  className?: string;
}) {
  const rotate =
    direction === "down" ? "rotate-90" : direction === "left" ? "rotate-180" : direction === "up" ? "-rotate-90" : "";
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 shrink-0 ${rotate} ${className}`.trim()}
      aria-hidden
    >
      <path
        d="M5 3.25 11 8 5 12.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
