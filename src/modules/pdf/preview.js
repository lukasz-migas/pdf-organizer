let workerConfigured = false;

/**
 * @typedef {object} PdfPreviewPage
 * @property {number} pageNumber
 * @property {string} dataUrl
 * @property {number} width
 * @property {number} height
 * @property {string} fullDataUrl
 * @property {number} fullWidth
 * @property {number} fullHeight
 */

/**
 * @typedef {object} PdfPreviewRenderOptions
 * @property {number} [thumbnailScale]
 * @property {number} [previewScale]
 */

function getPdfJs() {
  const pdfjsLib = globalThis.pdfjsLib;

  if (!pdfjsLib) {
    throw new Error("pdf.js failed to load.");
  }

  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.js";
    workerConfigured = true;
  }

  return pdfjsLib;
}

/**
 * Render every PDF page as a thumbnail and a higher-resolution modal preview.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @param {PdfPreviewRenderOptions} [options]
 * @returns {Promise<PdfPreviewPage[]>}
 */
export async function renderPdfPreviewPages(
  arrayBuffer,
  { thumbnailScale = 0.25, previewScale = 1.2 } = {},
) {
  const pdfjsLib = getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const thumbnailCanvas = await renderPageToCanvas(page, thumbnailScale);
    const previewCanvas = await renderPageToCanvas(page, previewScale);

    pages.push({
      pageNumber,
      dataUrl: thumbnailCanvas.toDataURL("image/png"),
      width: thumbnailCanvas.width,
      height: thumbnailCanvas.height,
      fullDataUrl: previewCanvas.toDataURL("image/png"),
      fullWidth: previewCanvas.width,
      fullHeight: previewCanvas.height,
    });
  }

  return pages;
}

/**
 * Render every PDF page as a thumbnail.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @param {number} [scale]
 * @returns {Promise<Array<Pick<PdfPreviewPage, "pageNumber" | "dataUrl" | "width" | "height">>>}
 */
export async function renderPdfToThumbnails(arrayBuffer, scale = 0.25) {
  const pdfjsLib = getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const thumbnails = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const canvas = await renderPageToCanvas(page, scale);
    thumbnails.push({
      pageNumber,
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    });
  }

  return thumbnails;
}

/**
 * Render a zero-based page index to a canvas.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @param {number} pageIndex
 * @param {number} [scale]
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderPdfPageToCanvas(arrayBuffer, pageIndex, scale = 0.35) {
  const pdfjsLib = getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const page = await pdf.getPage(pageIndex + 1);
  return renderPageToCanvas(page, scale);
}

/**
 * Render an already loaded PDF.js page to a canvas.
 *
 * @param {object} page
 * @param {number} scale
 * @returns {Promise<HTMLCanvasElement>}
 */
async function renderPageToCanvas(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas rendering is not supported in this browser.");
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}
