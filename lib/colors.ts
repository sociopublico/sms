export const TASK_COLORS = [
  "#4A9BE8",
  "#7EB6F0",
  "#3AA8C8",
  "#6BB8D4",
  "#A8C5E8",
  "#5BC89C",
  "#8FDBB8",
  "#70C4B4",
  "#A8D4C0",
  "#C8DCA0",
  "#8BA3C8",
  "#B8A8D4",
  "#D4B8E0",
  "#E8B8C8",
  "#E8C4B0",
  "#E8D8A0",
  "#E8A8A0",
  "#D4A090",
  "#9AABBC",
  "#C8B8A0",
] as const;

export function isPaletteColor(value: string) {
  return TASK_COLORS.some((c) => c.toLowerCase() === value.toLowerCase());
}
