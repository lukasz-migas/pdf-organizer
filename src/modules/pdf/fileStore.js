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
        documentType: inferDocumentType(file.name),
      };
    }),
  );
}

function inferDocumentType(filename) {
  const normalized = filename.trim().toLowerCase();
  const basename = normalized.replace(/\.pdf$/i, "");

  if (normalized.startsWith("vinted")) {
    return "whole-page";
  }

  if (looksHashLike(basename)) {
    return "bottom-40-rotated";
  }

  return "a4-quadrants";
}

function looksHashLike(basename) {
  if (basename.length < 10 || basename.length > 48) {
    return false;
  }

  if (!/^[a-z0-9_-]+$/i.test(basename)) {
    return false;
  }

  const stripped = basename.replaceAll("-", "").replaceAll("_", "");
  if (stripped.length < 10) {
    return false;
  }

  const hasLetters = /[a-z]/i.test(stripped);
  const hasDigits = /\d/.test(stripped);
  const vowelCount = (stripped.match(/[aeiou]/gi) ?? []).length;
  const vowelRatio = vowelCount / stripped.length;

  return hasLetters && hasDigits && vowelRatio < 0.25;
}
