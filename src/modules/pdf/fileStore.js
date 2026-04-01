import { renderPdfToThumbnails } from "./preview.js";

export async function normalizeFiles(fileList) {
  const files = Array.from(fileList).filter((file) => file.type === "application/pdf");

  return Promise.all(
    files.map(async (file, index) => {
      const arrayBuffer = await file.arrayBuffer();
      const thumbnails = await renderPdfToThumbnails(arrayBuffer, 0.18);

      return {
        id: `${file.name}-${file.size}-${index}`,
        file,
        arrayBuffer,
        thumbnails,
      };
    }),
  );
}
