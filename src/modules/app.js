import { createState } from "./state.js";
import { normalizeFiles } from "./pdf/fileStore.js";
import { getLayoutById, getLayouts } from "./layoutRegistry.js";
import {
  clearDragState,
  closePreviewModal,
  getDom,
  openPreviewModal,
  renderLabels,
  renderMergedPreview,
  renderSourceFiles,
  setActionState,
  setLabelsCollapsed,
  setProgress,
  setProgressVisibility,
  setStatus,
  wireDropZone,
} from "./ui.js";

export function createApp() {
  const state = createState();
  const dom = getDom();
  const layouts = getLayouts();

  if (window.location.protocol === "file:") {
    setStatus(dom, "Run this app through a local web server, for example: python3 -m http.server 8000");
  }

  wireDropZone(dom, (fileList) => handleIncomingFiles(fileList));

  dom.browseButton.addEventListener("click", () => dom.fileInput.click());
  dom.fileInput.addEventListener("change", async (event) => {
    await handleIncomingFiles(event.target.files);
    dom.fileInput.value = "";
  });
  dom.extractButton.addEventListener("click", () => extractLabels());
  dom.mergeButton.addEventListener("click", () => mergeLabels());
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
  setLabelsCollapsed(dom, true);
  setProgressVisibility(dom, false);
  setProgress(dom, "extract", { value: 0, total: 0, label: "Idle" });
  setProgress(dom, "merge", { value: 0, total: 0, label: "Idle" });

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
      const normalizedFiles = await normalizeFiles(validFiles);
      state.files = [...state.files, ...normalizedFiles];
      state.labels = [];
      await resetMergedOutput();

      renderSourceFiles(dom, state.files, layouts);
      renderLabels(dom, state.labels);
      state.labelsCollapsed = true;
      setLabelsCollapsed(dom, true);
      setProgressVisibility(dom, false);
      setProgress(dom, "extract", { value: 0, total: state.files.length, label: "Ready" });
      setProgress(dom, "merge", { value: 0, total: 0, label: "Idle" });
      setActionState(dom, { canExtract: state.files.length > 0, canMerge: false, canExport: false });
      setStatus(dom, `${state.files.length} PDF file${state.files.length === 1 ? "" : "s"} ready.`);
    } catch (error) {
      console.error(error);
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
      setProgress(dom, "extract", { value: 0, total: state.files.length, label: "Starting" });
      setProgress(dom, "merge", { value: 0, total: 0, label: "Idle" });

      const extractedLabels = [];

      for (let index = 0; index < state.files.length; index += 1) {
        const file = state.files[index];
        const layout = getLayoutById(file.documentType);
        const labels = await layout.extractLabels(file);
        extractedLabels.push(...labels);
        renderLabels(dom, extractedLabels);
        setProgress(dom, "extract", {
          value: index + 1,
          total: state.files.length,
          label: `${index + 1}/${state.files.length} files`,
        });
        setStatus(dom, `Processed ${file.file.name} as ${layout.name}: ${labels.length} labels detected.`);
      }

      state.labels = extractedLabels;
      if (!state.labels.length) {
        await resetMergedOutput();
        setProgress(dom, "extract", { value: state.files.length, total: state.files.length, label: "No labels found" });
        setProgressVisibility(dom, false);
        setActionState(dom, { canExtract: state.files.length > 0, canMerge: false, canExport: false });
        setStatus(dom, "No non-blank labels were detected.");
        return;
      }

      state.labelsCollapsed = false;
      setLabelsCollapsed(dom, false);
      setProgress(dom, "extract", {
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
      setProgress(dom, "extract", { value: 0, total: state.files.length, label: "Failed" });
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
      setProgress(dom, "merge", { value: 0, total: 1, label: "Building" });

      const layout = getMergeLayout();
      const mergedBuffer = await layout.composeOutput(state.labels);
      setProgress(dom, "merge", { value: 1, total: 1, label: "Rendering preview" });
      state.merged = createBlobRecord(mergedBuffer, "organized-labels.pdf");

      await renderMergedPreview(dom, mergedBuffer);
      setProgress(dom, "merge", { value: 1, total: 1, label: "Complete" });
      setActionState(dom, {
        canExtract: state.files.length > 0,
        canMerge: state.labels.length > 0,
        canExport: true,
      });
      setProgressVisibility(dom, false);
      setStatus(dom, `Done. ${state.labels.length} labels merged into a new output PDF.`);
    } catch (error) {
      console.error(error);
      setProgress(dom, "merge", { value: 0, total: 1, label: "Failed" });
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

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    printFrame.src = state.merged.url;
    document.body.appendChild(printFrame);

    printFrame.onload = () => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => printFrame.remove(), 1000);
    };
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
    setProgress(dom, "extract", { value: 0, total: state.files.length, label: "Ready" });
    setProgress(dom, "merge", { value: 0, total: 0, label: "Idle" });
    renderSourceFiles(dom, state.files, layouts);
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
    renderLabels(dom, state.labels);
    await resetMergedOutput();
    state.labelsCollapsed = true;
    setLabelsCollapsed(dom, true);
    setProgressVisibility(dom, false);
    setProgress(dom, "extract", { value: 0, total: state.files.length, label: state.files.length ? "Ready" : "Idle" });
    setProgress(dom, "merge", { value: 0, total: 0, label: "Idle" });
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
    setProgress(dom, "merge", { value: 0, total: 0, label: "Idle" });
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
    state.labelsCollapsed = true;
    renderSourceFiles(dom, state.files, layouts);
    renderLabels(dom, state.labels);
    await resetMergedOutput();
    setLabelsCollapsed(dom, true);
    setProgressVisibility(dom, false);
    setProgress(dom, "extract", { value: 0, total: 0, label: "Idle" });
    setProgress(dom, "merge", { value: 0, total: 0, label: "Idle" });
    setActionState(dom, { canExtract: false, canMerge: false, canExport: false });
    setStatus(dom, "Waiting for PDF files.");
    dom.fileInput.value = "";
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
