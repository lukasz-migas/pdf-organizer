import { createState } from "./state.js";
import { normalizeFiles } from "./pdf/fileStore.js";
import { getLayoutById } from "./layoutRegistry.js";
import {
  getDom,
  renderLabels,
  renderMergedPreview,
  renderSourceFiles,
  setActionState,
  setStatus,
  wireDropZone,
} from "./ui.js";

export function createApp() {
  const state = createState();
  const dom = getDom();

  if (window.location.protocol === "file:") {
    setStatus(dom, "Run this app through a local web server, for example: python3 -m http.server 8000");
  }

  wireDropZone(dom, (fileList) => handleIncomingFiles(fileList));

  dom.browseButton.addEventListener("click", () => dom.fileInput.click());
  dom.fileInput.addEventListener("change", async (event) => {
    await handleIncomingFiles(event.target.files);
    dom.fileInput.value = "";
  });
  dom.processButton.addEventListener("click", () => processFiles());
  dom.downloadButton.addEventListener("click", () => downloadMergedPdf());
  dom.printButton.addEventListener("click", () => printMergedPdf());

  setActionState(dom, { canProcess: false, canExport: false });

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

      renderSourceFiles(dom, state.files);
      renderLabels(dom, state.labels);
      setActionState(dom, { canProcess: state.files.length > 0, canExport: false });
      setStatus(dom, `${state.files.length} PDF file${state.files.length === 1 ? "" : "s"} ready.`);
    } catch (error) {
      console.error(error);
      setStatus(dom, `Could not load PDF files: ${error.message}`);
    }
  }

  async function processFiles() {
    if (!state.files.length) {
      return;
    }

    try {
      const layout = getLayoutById(dom.layoutSelect.value);
      setStatus(dom, `Extracting labels using ${layout.name}...`);
      setActionState(dom, { canProcess: false, canExport: false });

      const extractedLabels = [];

      for (const file of state.files) {
        const labels = await layout.extractLabels(file);
        extractedLabels.push(...labels);
        renderLabels(dom, extractedLabels);
        setStatus(dom, `Processed ${file.file.name}: ${labels.length} labels detected.`);
      }

      state.labels = extractedLabels;
      if (!state.labels.length) {
        await resetMergedOutput();
        setActionState(dom, { canProcess: state.files.length > 0, canExport: false });
        setStatus(dom, "No non-blank labels were detected.");
        return;
      }

      setStatus(dom, "Building merged PDF...");
      const mergedBuffer = await layout.composeOutput(state.labels);
      state.merged = createBlobRecord(mergedBuffer, "organized-labels.pdf");

      await renderMergedPreview(dom, mergedBuffer);
      setActionState(dom, {
        canProcess: state.files.length > 0,
        canExport: true,
      });
      setStatus(dom, `Done. ${state.labels.length} labels merged into a new output PDF.`);
    } catch (error) {
      console.error(error);
      setActionState(dom, { canProcess: state.files.length > 0, canExport: Boolean(state.merged) });
      setStatus(dom, `Processing failed: ${error.message}`);
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
}

function createBlobRecord(arrayBuffer, filename) {
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  return {
    blob,
    url: URL.createObjectURL(blob),
    filename,
  };
}
