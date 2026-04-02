import { LabelLayoutStrategy } from "./base.js";
import { composeLabelsToGrid, createLabelRecord } from "./helpers.js";

const { PDFDocument } = window.PDFLib;

export class WholePageLayout extends LabelLayoutStrategy {
  constructor() {
    super({ id: "whole-page", name: "1x1" });
  }

  async extractLabels(fileRecord) {
    const sourcePdf = await PDFDocument.load(fileRecord.arrayBuffer.slice(0));
    const labels = [];

    for (let pageIndex = 0; pageIndex < sourcePdf.getPageCount(); pageIndex += 1) {
      const page = sourcePdf.getPage(pageIndex);
      const { width, height } = page.getSize();
      const labelPdf = await PDFDocument.create();
      const labelPage = labelPdf.addPage([width, height]);
      const embeddedPage = await labelPdf.embedPage(page);

      labelPage.drawPage(embeddedPage, {
        x: 0,
        y: 0,
        width,
        height,
      });

      const pdfBytes = await labelPdf.save();
      const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
      labels.push(
        await createLabelRecord({
          id: `${fileRecord.id}-p${pageIndex + 1}-full`,
          fileRecord,
          sourcePage: pageIndex + 1,
          partKey: "full-page",
          pdfBuffer,
        }),
      );
    }

    return labels;
  }

  async composeOutput(labels) {
    return composeLabelsToGrid(labels);
  }
}
