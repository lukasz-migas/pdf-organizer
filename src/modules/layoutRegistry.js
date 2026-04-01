import { A4QuadrantsLayout } from "./layouts/a4Quadrants.js";

const layouts = [new A4QuadrantsLayout()];

export function getLayoutById(id) {
  return layouts.find((layout) => layout.id === id) ?? layouts[0];
}

export function getLayouts() {
  return layouts;
}
