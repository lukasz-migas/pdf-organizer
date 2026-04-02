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
  const { drawDividers = false, slotPattern = [0, 1, 2, 3], slotPlans = [] } = options;

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

  const fallbackSlots = slotPattern.length ? slotPattern : [0, 1, 2, 3];
  const pagePlans = buildOrderedPagePlans(preparedLabels.length, slotPlans, fallbackSlots);
  let labelIndex = 0;

  while (labelIndex < preparedLabels.length) {
    const activeSlots = pagePlans.shift() ?? fallbackSlots;
    const pageWidth = cellWidth * 2;
    const pageHeight = cellHeight * 2;
    const outputPage = outputPdf.addPage([pageWidth, pageHeight]);
    const chunk = preparedLabels.slice(labelIndex, labelIndex + activeSlots.length);

    for (let chunkIndex = 0; chunkIndex < chunk.length; chunkIndex += 1) {
      const prepared = chunk[chunkIndex];
      const embedded = await outputPdf.embedPage(prepared.labelPage);
      const placement = GRID_POSITIONS[activeSlots[chunkIndex]];
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

    labelIndex += activeSlots.length;
  }

  const bytes = await outputPdf.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function buildOrderedPagePlans(labelCount, slotPlans, fallbackSlots) {
  const fullPageSize = fallbackSlots.length;
  const normalizedPlans = slotPlans.map((slots, index) => ({
    slots,
    size: slots.length,
    index,
    key: slots.join(","),
  }));
  const explicitCapacity = normalizedPlans.reduce((total, plan) => total + plan.size, 0);
  const labelsOutsideExplicitPlans = Math.max(0, labelCount - explicitCapacity);
  const fallbackFullPageCount = Math.floor(labelsOutsideExplicitPlans / fullPageSize);
  const fallbackRemainder = labelsOutsideExplicitPlans % fullPageSize;

  const fullPlans = normalizedPlans.filter((plan) => plan.size === fullPageSize).map((plan) => plan.slots);
  const partialPlans = groupPartialPlans(normalizedPlans.filter((plan) => plan.size < fullPageSize));

  for (let index = 0; index < fallbackFullPageCount; index += 1) {
    fullPlans.push(fallbackSlots);
  }

  if (fallbackRemainder > 0) {
    partialPlans.push(...groupPartialPlans([
      {
        slots: fallbackSlots.slice(0, fallbackRemainder),
        size: fallbackRemainder,
        index: normalizedPlans.length,
        key: fallbackSlots.slice(0, fallbackRemainder).join(","),
      },
    ]));
  }

  return [...fullPlans, ...partialPlans];
}

function groupPartialPlans(partialPlans) {
  const groupedPlans = new Map();

  for (const plan of partialPlans) {
    const existingGroup = groupedPlans.get(plan.key);
    if (existingGroup) {
      existingGroup.plans.push(plan.slots);
      continue;
    }

    groupedPlans.set(plan.key, {
      size: plan.size,
      index: plan.index,
      plans: [plan.slots],
    });
  }

  return [...groupedPlans.values()]
    .sort((left, right) => right.size - left.size || left.index - right.index)
    .flatMap((group) => group.plans);
}
