import { A4QuadrantsLayout } from "./layouts/a4Quadrants.js";
import { BottomFortyRotatedLayout } from "./layouts/bottomFortyRotated.js";
import { WholePageLayout } from "./layouts/wholePage.js";

const layouts = [new A4QuadrantsLayout(), new WholePageLayout(), new BottomFortyRotatedLayout()];

export function getLayoutById(id) {
  return layouts.find((layout) => layout.id === id) ?? layouts[0];
}

export function getLayouts() {
  return layouts;
}
