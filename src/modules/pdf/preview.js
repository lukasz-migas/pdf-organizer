let workerConfigured = false;

function getPdfJs() {
  const pdfjsLib = globalThis.pdfjsLib;

  if (!pdfjsLib) {
    throw new Error("pdf.js failed to load.");
  }

  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    workerConfigured = true;
  }

  return pdfjsLib;
}

export async function renderPdfToThumbnails(arrayBuffer, scale = 0.25) {
  const pdfjsLib = getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const thumbnails = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
    thumbnails.push({
      pageNumber,
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    });
  }

  return thumbnails;
}

export async function renderPdfPageToCanvas(arrayBuffer, pageIndex, scale = 0.35) {
  const pdfjsLib = getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}
