import { createState } from "./state.js";
import { normalizeFiles } from "./pdf/fileStore.js";
import { getLayoutById, getLayouts } from "./layoutRegistry.js";
import { getOutputPatternById, getOutputPatterns } from "./outputPatterns.js";
import {
  clearDragState,
  closePreviewModal,
  getDom,
  openPreviewModal,
  renderLabels,
  renderMergedPreview,
  renderOutputPlanner,
  getOutputPlanCount,
  resetOutputPlanCounts,
  renderSourceFiles,
  setActionState,
  setLabelsCollapsed,
  setOutputPlanCount,
  setOutputPlanCollapsed,
  setProgress,
  setProgressVisibility,
  setSourceCollapsed,
  setStatus,
  wireDropZone,
} from "./ui.js";

export function createApp() {
  const state = createState();
  const dom = getDom();
  const layouts = getLayouts();
  const outputPatterns = getOutputPatterns();

  if (window.location.protocol === "file:") {
    setStatus(dom, "Run this app through a local web server, for example: python3 -m http.server 8000");
  }

  renderOutputPlanner(dom, outputPatterns);
  wireDropZone(dom, (fileList) => handleIncomingFiles(fileList));

  dom.browseButton.addEventListener("click", () => dom.fileInput.click());
  dom.fileInput.addEventListener("change", async (event) => {
    await handleIncomingFiles(event.target.files);
    dom.fileInput.value = "";
  });
  dom.extractButton.addEventListener("click", () => extractLabels());
  dom.mergeButton.addEventListener("click", () => mergeLabels());
  dom.resetOutputPlanButton.addEventListener("click", () => resetOutputPlan());
  dom.outputPlanner.addEventListener("click", (event) => handleOutputPlanClick(event));
  dom.toggleOutputPlanButton.addEventListener("click", () => {
    state.outputPlanCollapsed = !state.outputPlanCollapsed;
    setOutputPlanCollapsed(dom, state.outputPlanCollapsed);
  });
  dom.clearButton.addEventListener("click", () => clearAllFiles());
  dom.downloadButton.addEventListener("click", () => downloadMergedPdf());
  dom.printButton.addEventListener("click", () => printMergedPdf());
  dom.sourceList.addEventListener("change", async (event) => handleFileTypeChange(event));
  dom.sourceList.addEventListener("click", async (event) => {
    if (await handleRemoveFile(event)) {
      return;
    }
    handlePreviewClick(event);
  });
  dom.labelGrid.addEventListener("click", (event) => handlePreviewClick(event));
  dom.mergedPreview.addEventListener("click", (event) => handlePreviewClick(event));
  dom.labelGrid.addEventListener("dragstart", (event) => handleLabelDragStart(event));
  dom.labelGrid.addEventListener("dragover", (event) => handleLabelDragOver(event));
  dom.labelGrid.addEventListener("dragleave", (event) => handleLabelDragLeave(event));
  dom.labelGrid.addEventListener("drop", (event) => handleLabelDrop(event));
  dom.labelGrid.addEventListener("dragend", () => clearDragState(dom));
  dom.toggleSourceButton.addEventListener("click", () => {
    state.sourceCollapsed = !state.sourceCollapsed;
    setSourceCollapsed(dom, state.sourceCollapsed);
  });
  dom.toggleLabelsButton.addEventListener("click", () => {
    state.labelsCollapsed = !state.labelsCollapsed;
    setLabelsCollapsed(dom, state.labelsCollapsed);
  });
  dom.closeModalButton.addEventListener("click", () => closePreviewModal(dom));
  dom.modalBackdrop.addEventListener("click", () => closePreviewModal(dom));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dom.previewModal.hidden) {
      closePreviewModal(dom);
    }
  });

  setActionState(dom, { canExtract: false, canMerge: false, canExport: false });
  setOutputPlanCollapsed(dom, true);
  setSourceCollapsed(dom, false);
  setLabelsCollapsed(dom, true);
  setProgressVisibility(dom, false);
  setProgress(dom, { phase: "Idle", value: 0, total: 0, label: "Idle" });

  let draggedLabelId = null;

  async function handleIncomingFiles(fileList) {
    try {
      const validFiles = Array.from(fileList ?? []).filter(
        (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
      );

      if (!validFiles.length) {
        setStatus(dom, "Only PDF files are supported.");
        return;
      }

      setStatus(dom, "Loading source PDF previews...");
      setProgressVisibility(dom, true);
      setProgress(dom, { phase: "Loading", value: 0, total: validFiles.length, label: "Starting" });
      const normalizedFiles = await normalizeFiles(validFiles);
      state.files = [...state.files, ...normalizedFiles];
      state.labels = [];
      await resetMergedOutput();

      renderSourceFiles(dom, state.files, layouts);
      renderLabels(dom, state.labels);
      setSourceCollapsed(dom, state.sourceCollapsed);
      state.labelsCollapsed = true;
      setLabelsCollapsed(dom, true);
      setProgressVisibility(dom, false);
      setProgress(dom, { phase: "Idle", value: 0, total: 0, label: "Idle" });
      setActionState(dom, { canExtract: state.files.length > 0, canMerge: false, canExport: false });
      setStatus(dom, `${state.files.length} PDF file${state.files.length === 1 ? "" : "s"} ready.`);
    } catch (error) {
      console.error(error);
      setProgressVisibility(dom, false);
      setStatus(dom, `Could not load PDF files: ${error.message}`);
    }
  }

  async function extractLabels() {
    if (!state.files.length) {
      return;
    }

    try {
      setStatus(dom, "Extracting labels...");
      setActionState(dom, { canExtract: false, canMerge: false, canExport: false });
      setProgressVisibility(dom, true);
      setProgress(dom, { phase: "Extracting", value: 0, total: state.files.length, label: "Starting" });

      const extractedLabels = [];

      for (let index = 0; index < state.files.length; index += 1) {
        const file = state.files[index];
        const layout = getLayoutById(file.documentType);
        const labels = await layout.extractLabels(file);
        extractedLabels.push(...labels);
        renderLabels(dom, extractedLabels);
        setProgress(dom, {
          phase: "Extracting",
          value: index + 1,
          total: state.files.length,
          label: `${index + 1}/${state.files.length} files`,
        });
        setStatus(dom, `Processed ${file.file.name} as ${layout.name}: ${labels.length} labels detected.`);
      }

      state.labels = extractedLabels;
      if (!state.labels.length) {
        await resetMergedOutput();
        setProgress(dom, { phase: "Extracting", value: state.files.length, total: state.files.length, label: "No labels found" });
        setProgressVisibility(dom, false);
        setActionState(dom, { canExtract: state.files.length > 0, canMerge: false, canExport: false });
        setStatus(dom, "No non-blank labels were detected.");
        return;
      }

      state.labelsCollapsed = false;
      setLabelsCollapsed(dom, false);
      setProgress(dom, {
        phase: "Extracting",
        value: state.files.length,
        total: state.files.length,
        label: `${state.labels.length} labels ready`,
      });
      setActionState(dom, {
        canExtract: state.files.length > 0,
        canMerge: true,
        canExport: false,
      });
      setProgressVisibility(dom, false);
      setStatus(dom, `Done. ${state.labels.length} labels extracted and ready to merge.`);
    } catch (error) {
      console.error(error);
      setProgress(dom, { phase: "Extracting", value: 0, total: state.files.length, label: "Failed" });
      setProgressVisibility(dom, false);
      setActionState(dom, {
        canExtract: state.files.length > 0,
        canMerge: state.labels.length > 0,
        canExport: Boolean(state.merged),
      });
      setStatus(dom, `Extraction failed: ${error.message}`);
    }
  }

  async function mergeLabels() {
    if (!state.labels.length) {
      return;
    }

    try {
      setStatus(dom, "Building merged PDF...");
      setActionState(dom, { canExtract: false, canMerge: false, canExport: false });
      setProgressVisibility(dom, true);
      setProgress(dom, { phase: "Merging", value: 0, total: 1, label: "Building" });

      const layout = getMergeLayout();
      const slotPlans = getRequestedSlotPlans();
      const mergedBuffer = await layout.composeOutput(state.labels, {
        drawDividers: dom.dividerToggle.checked,
        slotPattern: getOutputPatternById("full-4").slots,
        slotPlans,
      });
      setProgress(dom, { phase: "Merging", value: 1, total: 1, label: "Rendering preview" });
      state.merged = createBlobRecord(mergedBuffer, "organized-labels.pdf");

      await renderMergedPreview(dom, mergedBuffer);
      setProgress(dom, { phase: "Merging", value: 1, total: 1, label: "Complete" });
      setActionState(dom, {
        canExtract: state.files.length > 0,
        canMerge: state.labels.length > 0,
        canExport: true,
      });
      setProgressVisibility(dom, false);
      setStatus(dom, `Done. ${state.labels.length} labels merged into a new output PDF.`);
    } catch (error) {
      console.error(error);
      setProgress(dom, { phase: "Merging", value: 0, total: 1, label: "Failed" });
      setProgressVisibility(dom, false);
      setActionState(dom, {
        canExtract: state.files.length > 0,
        canMerge: state.labels.length > 0,
        canExport: Boolean(state.merged),
      });
      setStatus(dom, `Merge failed: ${error.message}`);
    }
  }

  function downloadMergedPdf() {
    if (!state.merged) {
      return;
    }

    const link = document.createElement("a");
    link.href = state.merged.url;
    link.download = state.merged.filename;
    link.click();
  }

  function printMergedPdf() {
    if (!state.merged) {
      return;
    }

    const printWindow = window.open(state.merged.url, "_blank", "noopener,noreferrer");

    if (!printWindow) {
      setStatus(dom, "Print popup was blocked. Allow popups or download the PDF and print it manually.");
      return;
    }

    setStatus(dom, "Opening PDF in a temporary window for printing...");

    const triggerPrint = () => {
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
          setStatus(dom, "Print dialog opened.");
        } catch (error) {
          console.error(error);
          setStatus(dom, "Direct print failed. Download the PDF and print it manually.");
        }
      }, 800);
    };

    printWindow.addEventListener("load", triggerPrint, { once: true });
  }

  async function resetMergedOutput() {
    if (state.merged?.url) {
      URL.revokeObjectURL(state.merged.url);
    }
    state.merged = null;
    await renderMergedPreview(dom, null);
  }

  async function handleFileTypeChange(event) {
    const select = event.target.closest("[data-file-type-select]");
    if (!select) {
      return;
    }

    const file = state.files.find((entry) => entry.id === select.dataset.fileId);
    if (!file) {
      return;
    }

    file.documentType = select.value;
    state.labels = [];
    renderLabels(dom, state.labels);
    await resetMergedOutput();
    state.labelsCollapsed = true;
    setLabelsCollapsed(dom, true);
    setProgressVisibility(dom, false);
    setProgress(dom, { phase: "Idle", value: 0, total: 0, label: "Idle" });
    renderSourceFiles(dom, state.files, layouts);
    setSourceCollapsed(dom, state.sourceCollapsed);
    setActionState(dom, { canExtract: state.files.length > 0, canMerge: false, canExport: false });
    setStatus(dom, `Updated ${file.file.name} to ${getLayoutById(file.documentType).name}.`);
  }

  async function handleRemoveFile(event) {
    const button = event.target.closest("[data-remove-file-id]");
    if (!button) {
      return false;
    }

    const fileId = button.dataset.removeFileId;
    const removedFile = state.files.find((entry) => entry.id === fileId);
    if (!removedFile) {
      return true;
    }

    state.files = state.files.filter((entry) => entry.id !== fileId);
    state.labels = [];
    renderSourceFiles(dom, state.files, layouts);
    setSourceCollapsed(dom, state.sourceCollapsed);
    renderLabels(dom, state.labels);
    await resetMergedOutput();
    state.labelsCollapsed = true;
    setLabelsCollapsed(dom, true);
    setProgressVisibility(dom, false);
    setProgress(dom, { phase: "Idle", value: 0, total: 0, label: "Idle" });
    setActionState(dom, {
      canExtract: state.files.length > 0,
      canMerge: false,
      canExport: false,
    });
    setStatus(
      dom,
      state.files.length
        ? `Removed ${removedFile.file.name}. Extract labels again to rebuild the working set.`
        : "Waiting for PDF files.",
    );
    return true;
  }

  function handlePreviewClick(event) {
    const trigger = event.target.closest("[data-preview-src]");
    if (!trigger) {
      return;
    }

    openPreviewModal(dom, {
      src: trigger.dataset.previewSrc,
      title: trigger.dataset.previewTitle ?? "Preview",
      caption: trigger.dataset.previewCaption ?? "",
    });
  }

  function handleLabelDragStart(event) {
    const card = event.target.closest("[data-label-id]");
    if (!card) {
      return;
    }

    draggedLabelId = card.dataset.labelId;
    card.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedLabelId);
  }

  function handleLabelDragOver(event) {
    if (!draggedLabelId) {
      return;
    }

    const card = event.target.closest("[data-label-id]");
    if (!card || card.dataset.labelId === draggedLabelId) {
      return;
    }

    event.preventDefault();
    clearDragState(dom);
    card.classList.add("is-drop-target");
  }

  function handleLabelDragLeave(event) {
    const card = event.target.closest("[data-label-id]");
    if (!card) {
      return;
    }

    card.classList.remove("is-drop-target");
  }

  async function handleLabelDrop(event) {
    if (!draggedLabelId) {
      return;
    }

    const card = event.target.closest("[data-label-id]");
    clearDragState(dom);

    if (!card || card.dataset.labelId === draggedLabelId) {
      draggedLabelId = null;
      return;
    }

    event.preventDefault();
    const fromIndex = state.labels.findIndex((label) => label.id === draggedLabelId);
    const toIndex = state.labels.findIndex((label) => label.id === card.dataset.labelId);

    if (fromIndex === -1 || toIndex === -1) {
      draggedLabelId = null;
      return;
    }

    const [movedLabel] = state.labels.splice(fromIndex, 1);
    state.labels.splice(toIndex, 0, movedLabel);
    renderLabels(dom, state.labels);
    await resetMergedOutput();
    setProgressVisibility(dom, false);
    setProgress(dom, { phase: "Idle", value: 0, total: 0, label: "Idle" });
    setActionState(dom, {
      canExtract: state.files.length > 0,
      canMerge: state.labels.length > 0,
      canExport: false,
    });
    setStatus(dom, "Label order updated. Re-run merge to build a PDF with the new sequence.");
    draggedLabelId = null;
  }

  async function clearAllFiles() {
    state.files = [];
    state.labels = [];
    state.outputPlanCollapsed = true;
    state.sourceCollapsed = false;
    state.labelsCollapsed = true;
    renderSourceFiles(dom, state.files, layouts);
    setOutputPlanCollapsed(dom, true);
    setSourceCollapsed(dom, state.sourceCollapsed);
    renderLabels(dom, state.labels);
    await resetMergedOutput();
    resetOutputPlanCounts(dom);
    setLabelsCollapsed(dom, true);
    setProgressVisibility(dom, false);
    setProgress(dom, { phase: "Idle", value: 0, total: 0, label: "Idle" });
    setActionState(dom, { canExtract: false, canMerge: false, canExport: false });
    setStatus(dom, "Waiting for PDF files.");
    dom.fileInput.value = "";
  }

  function getRequestedSlotPlans() {
    const plans = [];

    for (const pattern of outputPatterns) {
      const count = getOutputPlanCount(dom, pattern.id);
      if (!Number.isFinite(count) || count <= 0) {
        continue;
      }

      for (let index = 0; index < count; index += 1) {
        plans.push(pattern.slots);
      }
    }

    return plans;
  }

  function resetOutputPlan() {
    resetOutputPlanCounts(dom);
    setStatus(dom, "Output sheet plan reset. Standard 2x2 output will be used unless you set counts again.");
  }

  function handleOutputPlanClick(event) {
    const incrementButton = event.target.closest("[data-pattern-increment]");
    if (incrementButton) {
      const patternId = incrementButton.dataset.patternIncrement;
      const nextCount = getOutputPlanCount(dom, patternId) + 1;
      setOutputPlanCount(dom, patternId, nextCount);
      setStatus(dom, `${getOutputPatternById(patternId).name} set to ${nextCount}.`);
      return;
    }

    const resetButton = event.target.closest("[data-pattern-reset]");
    if (resetButton) {
      const patternId = resetButton.dataset.patternReset;
      setOutputPlanCount(dom, patternId, 0);
      setStatus(dom, `${getOutputPatternById(patternId).name} reset to 0.`);
    }
  }

  function getMergeLayout() {
    const firstLabel = state.labels[0];
    if (!firstLabel) {
      throw new Error("No labels available for merging.");
    }

    return getLayoutById(firstLabel.documentType);
  }
}

function createBlobRecord(arrayBuffer, filename) {
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  return {
    blob,
    url: URL.createObjectURL(blob),
    filename,
  };
}
