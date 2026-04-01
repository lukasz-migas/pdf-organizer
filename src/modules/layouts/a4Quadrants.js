import { LabelLayoutStrategy } from "./base.js";
import { renderPdfPageToCanvas } from "../pdf/preview.js";

const { PDFDocument } = window.PDFLib;

const QUADRANTS = [
  { key: "top-left", xFactor: 0, yFactor: 1 },
  { key: "top-right", xFactor: 1, yFactor: 1 },
  { key: "bottom-left", xFactor: 0, yFactor: 0 },
  { key: "bottom-right", xFactor: 1, yFactor: 0 },
];

export class A4QuadrantsLayout extends LabelLayoutStrategy {
  constructor() {
    super({ id: "a4-quadrants", name: "A4 quadrants" });
  }

  async extractLabels(fileRecord) {
    const sourcePdf = await PDFDocument.load(fileRecord.arrayBuffer.slice(0));
    const labels = [];

    for (let pageIndex = 0; pageIndex < sourcePdf.getPageCount(); pageIndex += 1) {
      const page = sourcePdf.getPage(pageIndex);
      const { width, height } = page.getSize();
      const quadrantWidth = width / 2;
      const quadrantHeight = height / 2;
      const pagePreview = await renderPdfPageToCanvas(fileRecord.arrayBuffer, pageIndex, 0.55);

      for (const quadrant of QUADRANTS) {
        const x = quadrant.xFactor * quadrantWidth;
        const y = quadrant.yFactor * quadrantHeight;
        const isBlank = detectBlankQuadrant(pagePreview, quadrant);

        if (isBlank) {
          continue;
        }

        const labelPdf = await PDFDocument.create();
        const labelPage = labelPdf.addPage([quadrantWidth, quadrantHeight]);
        const embeddedPage = await labelPdf.embedPage(page, {
          left: x,
          right: x + quadrantWidth,
          bottom: y,
          top: y + quadrantHeight,
        });

        labelPage.drawPage(embeddedPage, {
          x: 0,
          y: 0,
          width: quadrantWidth,
          height: quadrantHeight,
        });

        const pdfBytes = await labelPdf.save();
        const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
        const thumbCanvas = await renderPdfPageToCanvas(pdfBuffer, 0, 0.48);

        labels.push({
          id: `${fileRecord.id}-p${pageIndex + 1}-${quadrant.key}`,
          sourceFileId: fileRecord.id,
          sourceFileName: fileRecord.file.name,
          sourcePage: pageIndex + 1,
          quadrant: quadrant.key,
          pdfBuffer,
          previewDataUrl: thumbCanvas.toDataURL("image/png"),
        });
      }
    }

    return labels;
  }

  async composeOutput(labels) {
    const outputPdf = await PDFDocument.create();

    if (!labels.length) {
      const bytes = await outputPdf.save();
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }

    const firstLabel = await PDFDocument.load(labels[0].pdfBuffer.slice(0));
    const firstPage = firstLabel.getPage(0);
    const { width: labelWidth, height: labelHeight } = firstPage.getSize();
    const pageWidth = labelWidth * 2;
    const pageHeight = labelHeight * 2;

    for (let index = 0; index < labels.length; index += 4) {
      const outputPage = outputPdf.addPage([pageWidth, pageHeight]);
      const chunk = labels.slice(index, index + 4);

      for (let chunkIndex = 0; chunkIndex < chunk.length; chunkIndex += 1) {
        const label = chunk[chunkIndex];
        const labelPdf = await PDFDocument.load(label.pdfBuffer.slice(0));
        const labelPage = labelPdf.getPage(0);
        const embedded = await outputPdf.embedPage(labelPage);
        const placement = QUADRANTS[chunkIndex];

        outputPage.drawPage(embedded, {
          x: placement.xFactor * labelWidth,
          y: placement.yFactor * labelHeight,
          width: labelWidth,
          height: labelHeight,
        });
      }
    }

    const bytes = await outputPdf.save();
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
}

function detectBlankQuadrant(pageCanvas, quadrant) {
  const width = Math.floor(pageCanvas.width / 2);
  const height = Math.floor(pageCanvas.height / 2);
  const startX = quadrant.xFactor * width;
  const startY = quadrant.yFactor === 1 ? 0 : height;
  const context = pageCanvas.getContext("2d", { willReadFrequently: true });
  const { data } = context.getImageData(startX, startY, width, height);

  let nonWhiteSamples = 0;
  const sampleStep = 16;

  for (let index = 0; index < data.length; index += 4 * sampleStep) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const alpha = data[index + 3];

    if (alpha < 10) {
      continue;
    }

    const luminance = (red + green + blue) / 3;
    if (luminance < 245) {
      nonWhiteSamples += 1;
    }
  }

  return nonWhiteSamples < 120;
}
