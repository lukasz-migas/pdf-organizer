import { renderPdfPageToCanvas } from "../pdf/preview.js";

const { PDFDocument } = window.PDFLib;
const { rgb } = window.PDFLib;

const GRID_POSITIONS = [
  { xFactor: 0, yFactor: 1 },
  { xFactor: 1, yFactor: 1 },
  { xFactor: 0, yFactor: 0 },
  { xFactor: 1, yFactor: 0 },
];

export async function createLabelRecord({
  id,
  fileRecord,
  sourcePage,
  partKey,
  pdfBuffer,
  previewScale = 0.48,
}) {
  const thumbCanvas = await renderPdfPageToCanvas(pdfBuffer, 0, previewScale);

  return {
    id,
    sourceFileId: fileRecord.id,
    sourceFileName: fileRecord.file.name,
    documentType: fileRecord.documentType,
    sourcePage,
    quadrant: partKey,
    pdfBuffer,
    previewDataUrl: thumbCanvas.toDataURL("image/png"),
  };
}

export async function composeLabelsToGrid(labels, options = {}) {
  const outputPdf = await PDFDocument.create();
  const { drawDividers = false } = options;

  if (!labels.length) {
    const bytes = await outputPdf.save();
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  const preparedLabels = [];
  let cellWidth = 0;
  let cellHeight = 0;

  for (const label of labels) {
    const labelPdf = await PDFDocument.load(label.pdfBuffer.slice(0));
    const labelPage = labelPdf.getPage(0);
    const { width, height } = labelPage.getSize();
    preparedLabels.push({ labelPage, width, height });
    cellWidth = Math.max(cellWidth, width);
    cellHeight = Math.max(cellHeight, height);
  }

  for (let index = 0; index < preparedLabels.length; index += 4) {
    const pageWidth = cellWidth * 2;
    const pageHeight = cellHeight * 2;
    const outputPage = outputPdf.addPage([pageWidth, pageHeight]);
    const chunk = preparedLabels.slice(index, index + 4);

    for (let chunkIndex = 0; chunkIndex < chunk.length; chunkIndex += 1) {
      const prepared = chunk[chunkIndex];
      const embedded = await outputPdf.embedPage(prepared.labelPage);
      const placement = GRID_POSITIONS[chunkIndex];
      const scale = Math.min(cellWidth / prepared.width, cellHeight / prepared.height);
      const drawWidth = prepared.width * scale;
      const drawHeight = prepared.height * scale;
      const offsetX = placement.xFactor * cellWidth + (cellWidth - drawWidth) / 2;
      const offsetY = placement.yFactor * cellHeight + (cellHeight - drawHeight) / 2;

      outputPage.drawPage(embedded, {
        x: offsetX,
        y: offsetY,
        width: drawWidth,
        height: drawHeight,
      });
    }

    if (drawDividers) {
      outputPage.drawRectangle({
        x: pageWidth / 2 - 1,
        y: 0,
        width: 2,
        height: pageHeight,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 1,
      });
      outputPage.drawRectangle({
        x: 0,
        y: pageHeight / 2 - 1,
        width: pageWidth,
        height: 2,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 1,
      });
    }
  }

  const bytes = await outputPdf.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
