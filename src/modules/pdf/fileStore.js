import { renderPdfPreviewPages } from "./preview.js";

/**
 * Normalize PDF files into file records with source-page previews.
 *
 * @param {FileList | File[]} fileList
 * @returns {Promise<Array<object>>}
 */
export async function normalizeFiles(fileList) {
  const files = Array.from(fileList).filter(
    (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
  );

  return Promise.all(
    files.map(async (file, index) => {
      const arrayBuffer = await file.arrayBuffer();
      const thumbnails = await renderPdfPreviewPages(arrayBuffer, {
        thumbnailScale: 0.18,
        previewScale: 1.2,
      });

      return {
        id: `${file.name}-${file.size}-${index}`,
        file,
        arrayBuffer,
        thumbnails,
        documentType: inferDocumentType(file),
      };
    }),
  );
}

function inferDocumentType(file) {
  const filename = file.name;
  const normalized = filename.trim().toLowerCase();
  const basename = normalized.replace(/\.pdf$/i, "");

  if (basename.startsWith("vinted-")) {
    return file.size < 100 * 1024 ? "whole-page" : "bottom-40-rotated";
  }

  if (basename.startsWith("returnlabel")) {
    return "whole-page";
  }

  if (basename.startsWith("order-") || basename.startsWith("orders-") || basename.startsWith("ebay")) {
    return "a4-quadrants";
  }

  if (basename.startsWith("vinted") || looksHashLike(basename)) {
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
