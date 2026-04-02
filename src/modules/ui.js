import { renderPdfToThumbnails } from "./pdf/preview.js";

export function getDom() {
  return {
    browseButton: document.querySelector("#browse-button"),
    fileInput: document.querySelector("#file-input"),
    dropZone: document.querySelector("#drop-zone"),
    extractButton: document.querySelector("#extract-button"),
    mergeButton: document.querySelector("#merge-button"),
    outputPlanPanel: document.querySelector("#output-plan-panel"),
    outputPlanner: document.querySelector("#output-planner"),
    resetOutputPlanButton: document.querySelector("#reset-output-plan-button"),
    toggleOutputPlanButton: document.querySelector("#toggle-output-plan-button"),
    dividerToggle: document.querySelector("#divider-toggle"),
    clearButton: document.querySelector("#clear-button"),
    downloadButton: document.querySelector("#download-button"),
    printButton: document.querySelector("#print-button"),
    progressStack: document.querySelector("#progress-stack"),
    progressBar: document.querySelector("#progress-bar"),
    progressPhase: document.querySelector("#progress-phase"),
    progressText: document.querySelector("#progress-text"),
    status: document.querySelector("#status"),
    sourcePanel: document.querySelector("#source-panel"),
    sourceList: document.querySelector("#source-list"),
    toggleSourceButton: document.querySelector("#toggle-source-button"),
    labelsPanel: document.querySelector("#labels-panel"),
    toggleLabelsButton: document.querySelector("#toggle-labels-button"),
    labelGrid: document.querySelector("#label-grid"),
    mergedPreview: document.querySelector("#merged-preview"),
    previewModal: document.querySelector("#preview-modal"),
    modalBackdrop: document.querySelector("#modal-backdrop"),
    closeModalButton: document.querySelector("#close-modal-button"),
    modalTitle: document.querySelector("#modal-title"),
    modalCaption: document.querySelector("#modal-caption"),
    modalImage: document.querySelector("#modal-image"),
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
    window.addEventListener(eventName, (event) => {
      if (event.dataTransfer?.types?.includes("Files")) {
        activate();
      }
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    window.addEventListener(eventName, (event) => {
      if (eventName === "drop" || event.relatedTarget === null) {
        deactivate();
      }
    });
  });

  window.addEventListener("drop", (event) => {
    if (event.dataTransfer?.files?.length) {
      onFiles(event.dataTransfer.files);
    }
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

export function renderSourceFiles(dom, files, layouts) {
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
                    <button
                      class="page-thumb-button"
                      type="button"
                      data-preview-src="${page.fullDataUrl ?? page.dataUrl}"
                      data-preview-title="${escapeHtml(file.file.name)}"
                      data-preview-caption="Source page ${page.pageNumber}"
                    >
                      <img class="thumb" src="${page.dataUrl}" alt="Preview of ${escapeHtml(file.file.name)} page ${page.pageNumber}" />
                    </button>
                    <div class="thumb-label">Page ${page.pageNumber}</div>
                  </div>
                `,
              )
              .join("")}
          </div>
          <div class="file-card-meta">
            <div class="file-card-header">
              <strong>${escapeHtml(file.file.name)}</strong>
              <div class="file-card-actions">
                <span class="badge">${escapeHtml(getLayoutLabel(layouts, file.documentType))}</span>
                <button
                  class="icon-button"
                  type="button"
                  data-remove-file-id="${escapeHtml(file.id)}"
                  aria-label="Remove ${escapeHtml(file.file.name)}"
                  title="Remove PDF"
                >
                  <span class="trash-icon" aria-hidden="true"></span>
                </button>
              </div>
            </div>
            <p>${file.thumbnails.length} page${file.thumbnails.length === 1 ? "" : "s"} • ${(file.file.size / 1024).toFixed(1)} KB</p>
            <label class="field">
              <span>Document type</span>
              <select data-file-type-select data-file-id="${escapeHtml(file.id)}">
                ${layouts
                  .map(
                    (layout) => `
                      <option value="${layout.id}" ${layout.id === file.documentType ? "selected" : ""}>
                        ${escapeHtml(layout.name)}
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
          </div>
        </article>
      `;
    })
    .join("");
}

export function renderOutputPlanner(dom, patterns) {
  dom.outputPlanner.innerHTML = patterns
    .map(
      (pattern) => `
        <label class="pattern-card">
          <div class="pattern-card-top">
            <span class="pattern-name">${escapeHtml(pattern.name)}</span>
            <span class="pattern-grid" aria-hidden="true">
              ${[0, 1, 2, 3]
                .map(
                  (slot) => `
                    <span class="pattern-cell ${pattern.slots.includes(slot) ? "is-filled" : ""}"></span>
                  `,
                )
                .join("")}
            </span>
          </div>
          <input
            class="pattern-count"
            type="number"
            min="0"
            step="1"
            value="0"
            data-pattern-id="${escapeHtml(pattern.id)}"
            aria-label="${escapeHtml(pattern.name)} page count"
          />
        </label>
      `,
    )
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
        <article class="preview-card is-draggable" draggable="true" data-label-id="${escapeHtml(label.id)}">
          <button
            class="thumb-button"
            type="button"
            data-preview-src="${label.previewDataUrl}"
            data-preview-title="Label ${index + 1}"
            data-preview-caption="${escapeHtml(label.sourceFileName)} • page ${label.sourcePage}"
          >
            <img class="thumb" src="${label.previewDataUrl}" alt="Label ${index + 1}" />
          </button>
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
          <button
            class="page-thumb-button"
            type="button"
            data-preview-src="${page.dataUrl}"
            data-preview-title="Merged PDF"
            data-preview-caption="Output page ${page.pageNumber}"
          >
            <img class="merged-page" src="${page.dataUrl}" alt="Merged PDF page ${page.pageNumber}" />
          </button>
          <p>Output page ${page.pageNumber}</p>
        </article>
      `,
    )
    .join("");
}

export function setStatus(dom, message) {
  dom.status.textContent = message;
}

export function setProgress(dom, { phase, value, total, label }) {
  const safeTotal = Math.max(total, 0);
  const safeValue = Math.min(Math.max(value, 0), safeTotal || 0);
  const percent = safeTotal > 0 ? (safeValue / safeTotal) * 100 : 0;

  dom.progressBar.style.width = `${percent}%`;
  dom.progressPhase.textContent = phase ?? "Idle";
  dom.progressText.textContent = label ?? (safeTotal > 0 ? `${safeValue}/${safeTotal}` : "Idle");
}

export function setActionState(dom, { canExtract, canMerge, canExport }) {
  dom.extractButton.disabled = !canExtract;
  dom.mergeButton.disabled = !canMerge;
  dom.clearButton.disabled = !(canExtract || canMerge || canExport);
  dom.downloadButton.disabled = !canExport;
  dom.printButton.disabled = !canExport;
}

export function setLabelsCollapsed(dom, collapsed) {
  dom.labelsPanel.classList.toggle("is-collapsed", collapsed);
  dom.toggleLabelsButton.textContent = collapsed ? "Expand" : "Collapse";
  dom.toggleLabelsButton.setAttribute("aria-expanded", String(!collapsed));
}

export function setSourceCollapsed(dom, collapsed) {
  dom.sourcePanel.classList.toggle("is-collapsed", collapsed);
  dom.toggleSourceButton.textContent = collapsed ? "Expand" : "Collapse";
  dom.toggleSourceButton.setAttribute("aria-expanded", String(!collapsed));
}

export function setOutputPlanCollapsed(dom, collapsed) {
  dom.outputPlanPanel.classList.toggle("is-collapsed", collapsed);
  dom.toggleOutputPlanButton.textContent = collapsed ? "Expand" : "Collapse";
  dom.toggleOutputPlanButton.setAttribute("aria-expanded", String(!collapsed));
}

export function openPreviewModal(dom, { src, title, caption }) {
  dom.modalImage.src = src;
  dom.modalImage.alt = title;
  dom.modalTitle.textContent = title;
  dom.modalCaption.textContent = caption ?? "";
  dom.previewModal.hidden = false;
  document.body.style.overflow = "hidden";
}

export function closePreviewModal(dom) {
  dom.previewModal.hidden = true;
  dom.modalImage.src = "";
  document.body.style.overflow = "";
}

export function clearDragState(dom) {
  dom.labelGrid.querySelectorAll(".preview-card").forEach((card) => {
    card.classList.remove("is-dragging", "is-drop-target");
  });
}

export function setProgressVisibility(dom, visible) {
  dom.progressStack.classList.toggle("is-hidden", !visible);
}

function getLayoutLabel(layouts, documentType) {
  return layouts.find((layout) => layout.id === documentType)?.name ?? documentType;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
