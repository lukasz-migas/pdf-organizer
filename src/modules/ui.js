import { renderPdfToThumbnails } from "./pdf/preview.js";

export function getDom() {
  return {
    browseButton: document.querySelector("#browse-button"),
    fileInput: document.querySelector("#file-input"),
    dropZone: document.querySelector("#drop-zone"),
    processButton: document.querySelector("#process-button"),
    downloadButton: document.querySelector("#download-button"),
    printButton: document.querySelector("#print-button"),
    layoutSelect: document.querySelector("#layout-select"),
    status: document.querySelector("#status"),
    sourceList: document.querySelector("#source-list"),
    labelGrid: document.querySelector("#label-grid"),
    mergedPreview: document.querySelector("#merged-preview"),
    sourceSummary: document.querySelector("#source-summary"),
    extractSummary: document.querySelector("#extract-summary"),
    mergedSummary: document.querySelector("#merged-summary"),
    fileCount: document.querySelector("#file-count"),
    labelCount: document.querySelector("#label-count"),
  };
}

export function wireDropZone(dom, onFiles) {
  const activate = () => dom.dropZone.classList.add("is-active");
  const deactivate = () => dom.dropZone.classList.remove("is-active");

  const preventWindowDrop = (event) => {
    if (event.dataTransfer?.types?.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  };

  ["dragenter", "dragover", "drop"].forEach((eventName) => {
    window.addEventListener(eventName, preventWindowDrop);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dom.dropZone.addEventListener(eventName, (event) => {
      preventWindowDrop(event);
      activate();
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dom.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      deactivate();
    });
  });

  dom.dropZone.addEventListener("drop", (event) => onFiles(event.dataTransfer.files));
  dom.dropZone.addEventListener("click", (event) => {
    if (event.target !== dom.fileInput) {
      dom.fileInput.click();
    }
  });
  dom.dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      dom.fileInput.click();
    }
  });
}

export function renderSourceFiles(dom, files) {
  dom.fileCount.textContent = String(files.length);
  dom.sourceSummary.textContent = files.length
    ? `${files.length} PDF${files.length === 1 ? "" : "s"} ready`
    : "No files yet";

  if (!files.length) {
    dom.sourceList.className = "file-list empty-state";
    dom.sourceList.textContent = "Uploaded PDFs will appear here.";
    return;
  }

  dom.sourceList.className = "file-list";
  dom.sourceList.innerHTML = files
    .map((file) => {
      return `
        <article class="file-card">
          <div class="thumb-strip">
            ${file.thumbnails
              .map(
                (page) => `
                  <div>
                    <img class="thumb" src="${page.dataUrl}" alt="Preview of ${escapeHtml(file.file.name)} page ${page.pageNumber}" />
                    <div class="thumb-label">Page ${page.pageNumber}</div>
                  </div>
                `,
              )
              .join("")}
          </div>
          <div>
            <strong>${escapeHtml(file.file.name)}</strong>
            <p>${file.thumbnails.length} page${file.thumbnails.length === 1 ? "" : "s"} • ${(file.file.size / 1024).toFixed(1)} KB</p>
          </div>
        </article>
      `;
    })
    .join("");
}

export function renderLabels(dom, labels) {
  dom.labelCount.textContent = String(labels.length);
  dom.extractSummary.textContent = labels.length
    ? `${labels.length} labels extracted`
    : "Nothing extracted";

  if (!labels.length) {
    dom.labelGrid.className = "preview-grid empty-state";
    dom.labelGrid.textContent = "Extracted labels will appear here after processing.";
    return;
  }

  dom.labelGrid.className = "preview-grid";
  dom.labelGrid.innerHTML = labels
    .map(
      (label, index) => `
        <article class="preview-card">
          <img class="thumb" src="${label.previewDataUrl}" alt="Label ${index + 1}" />
          <p>Label ${index + 1}<br />${escapeHtml(label.sourceFileName)} • page ${label.sourcePage}</p>
        </article>
      `,
    )
    .join("");
}

export async function renderMergedPreview(dom, mergedBuffer) {
  if (!mergedBuffer) {
    dom.mergedSummary.textContent = "No output yet";
    dom.mergedPreview.className = "merged-preview empty-state";
    dom.mergedPreview.textContent = "The rebuilt PDF preview will appear here.";
    return;
  }

  const pages = await renderPdfToThumbnails(mergedBuffer, 0.22);
  dom.mergedSummary.textContent = `${pages.length} output page${pages.length === 1 ? "" : "s"}`;
  dom.mergedPreview.className = "merged-preview";
  dom.mergedPreview.innerHTML = pages
    .map(
      (page) => `
        <article class="preview-card">
          <img class="merged-page" src="${page.dataUrl}" alt="Merged PDF page ${page.pageNumber}" />
          <p>Output page ${page.pageNumber}</p>
        </article>
      `,
    )
    .join("");
}

export function setStatus(dom, message) {
  dom.status.textContent = message;
}

export function setActionState(dom, { canProcess, canExport }) {
  dom.processButton.disabled = !canProcess;
  dom.downloadButton.disabled = !canExport;
  dom.printButton.disabled = !canExport;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
