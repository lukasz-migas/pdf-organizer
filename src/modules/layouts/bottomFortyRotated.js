import { LabelLayoutStrategy } from "./base.js";
import { composeLabelsToGrid, createLabelRecord } from "./helpers.js";
import { renderPdfPageToCanvas } from "../pdf/preview.js";

const { PDFDocument } = window.PDFLib;

const LABEL_PORTION = 0.4;
const LEFT_TRIM_PORTION = 0.15;
const RIGHT_TRIM_PORTION = 0.12;

export class BottomFortyRotatedLayout extends LabelLayoutStrategy {
  constructor() {
    super({ id: "bottom-40-rotated", name: "2x1 (cropped)" });
  }

  async extractLabels(fileRecord) {
    const labels = [];
    const pageCount = fileRecord.thumbnails.length;

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const pageCanvas = await renderPdfPageToCanvas(fileRecord.arrayBuffer, pageIndex, 1.6);
      const cropHeight = Math.round(pageCanvas.height * LABEL_PORTION);
      const cropY = pageCanvas.height - cropHeight;
      const bottomCanvas = document.createElement("canvas");
      const bottomContext = bottomCanvas.getContext("2d");
      bottomCanvas.width = pageCanvas.width;
      bottomCanvas.height = cropHeight;
      bottomContext.drawImage(
        pageCanvas,
        0,
        cropY,
        pageCanvas.width,
        cropHeight,
        0,
        0,
        pageCanvas.width,
        cropHeight,
      );

      const trimLeft = Math.round(bottomCanvas.width * LEFT_TRIM_PORTION);
      const trimRight = Math.round(bottomCanvas.width * RIGHT_TRIM_PORTION);
      const trimmedWidth = bottomCanvas.width - trimLeft - trimRight;
      const trimmedCanvas = document.createElement("canvas");
      const trimmedContext = trimmedCanvas.getContext("2d");
      trimmedCanvas.width = trimmedWidth;
      trimmedCanvas.height = bottomCanvas.height;
      trimmedContext.drawImage(
        bottomCanvas,
        trimLeft,
        0,
        trimmedWidth,
        bottomCanvas.height,
        0,
        0,
        trimmedWidth,
        bottomCanvas.height,
      );

      const rotatedCanvas = document.createElement("canvas");
      const rotatedContext = rotatedCanvas.getContext("2d");
      rotatedCanvas.width = trimmedCanvas.height;
      rotatedCanvas.height = trimmedCanvas.width;
      rotatedContext.translate(0, rotatedCanvas.height);
      rotatedContext.rotate(-Math.PI / 2);
      rotatedContext.drawImage(trimmedCanvas, 0, 0);

      const pngDataUrl = rotatedCanvas.toDataURL("image/png");
      const labelPdf = await PDFDocument.create();
      const pngImage = await labelPdf.embedPng(pngDataUrl);
      const labelPage = labelPdf.addPage([rotatedCanvas.width, rotatedCanvas.height]);

      labelPage.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: rotatedCanvas.width,
        height: rotatedCanvas.height,
      });

      const pdfBytes = await labelPdf.save();
      const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
      labels.push(
        await createLabelRecord({
          id: `${fileRecord.id}-p${pageIndex + 1}-bottom-40`,
          fileRecord,
          sourcePage: pageIndex + 1,
          partKey: "bottom-40-rotated",
          pdfBuffer,
        }),
      );
    }

    return labels;
  }

  async composeOutput(labels, options) {
    return composeLabelsToGrid(labels, options);
  }
}
