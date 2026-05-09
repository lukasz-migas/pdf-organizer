const outputPatterns = [
  { id: "full-4", name: "2x2", slots: [0, 1, 2, 3] },
  { id: "gap-bottom-left", name: "3-up BR", slots: [0, 1, 3] },
  { id: "gap-bottom-right", name: "3-up BL", slots: [0, 1, 2] },
  { id: "top-row", name: "2-up Top", slots: [0, 1] },
  { id: "left-column", name: "2-up Left", slots: [0, 2] },
  { id: "single-top-left", name: "1-up TL", slots: [0] },
  { id: "single-top-right", name: "1-up TR", slots: [1] },
];

export function getOutputPatterns() {
  return outputPatterns;
}

export function getOutputPatternById(id) {
  return outputPatterns.find((pattern) => pattern.id === id) ?? outputPatterns[0];
}
