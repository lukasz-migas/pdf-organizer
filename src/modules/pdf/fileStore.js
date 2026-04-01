import { renderPdfPageToCanvas, renderPdfToThumbnails } from "./preview.js";

export async function normalizeFiles(fileList) {
  const files = Array.from(fileList).filter(
    (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
  );

  return Promise.all(
    files.map(async (file, index) => {
      const arrayBuffer = await file.arrayBuffer();
      const thumbnails = await renderPdfToThumbnails(arrayBuffer, 0.18);
      const fullPreviews = await Promise.all(
        thumbnails.map(async (_, pageIndex) => {
          const canvas = await renderPdfPageToCanvas(arrayBuffer, pageIndex, 1.2);
          return canvas.toDataURL("image/png");
        }),
      );

      return {
        id: `${file.name}-${file.size}-${index}`,
        file,
        arrayBuffer,
        thumbnails: thumbnails.map((page, pageIndex) => ({
          ...page,
          fullDataUrl: fullPreviews[pageIndex],
        })),
        documentType: "a4-quadrants",
      };
    }),
  );
}
