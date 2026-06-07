/**
 * Create the mutable application state.
 *
 * @returns {object}
 */
export function createState() {
  return {
    files: [],
    labels: [],
    merged: null,
    mergedPreviewPages: [],
    outputPlanCollapsed: true,
    sourceCollapsed: false,
    labelsCollapsed: false,
    previewItems: [],
    previewIndex: 0,
  };
}
