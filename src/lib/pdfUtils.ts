export const CHUNKED_PDF_MARKER = '__CHUNKED__';

export interface ParsedDataUrl {
  bytes: Uint8Array;
  mime: string;
}

/**
 * Parses a data URL (or raw base64 string) into exact binary bytes and MIME type.
 * Returns null if the input cannot be decoded cleanly.
 */
export function parseDataUrlToBytes(dataUrl: string, fallbackMime = 'application/pdf'): ParsedDataUrl | null {
  if (!dataUrl || typeof dataUrl !== 'string' || dataUrl === CHUNKED_PDF_MARKER) {
    return null;
  }

  try {
    let mime = fallbackMime;
    let base64Part = dataUrl.trim();

    if (base64Part.startsWith('data:')) {
      const commaIdx = base64Part.indexOf(',');
      if (commaIdx === -1) return null;
      const header = base64Part.slice(5, commaIdx);
      const body = base64Part.slice(commaIdx + 1);
      const semiIdx = header.indexOf(';');
      const extractedMime = (semiIdx >= 0 ? header.slice(0, semiIdx) : header).trim();
      if (extractedMime) mime = extractedMime;

      if (!header.toLowerCase().includes('base64')) {
        // URL-encoded non-base64 data URL fallback
        const decodedText = decodeURIComponent(body);
        const bytes = new TextEncoder().encode(decodedText);
        return { bytes, mime };
      }

      base64Part = body;
    }

    // Remove any whitespace/newlines and fix URL-safe base64 if present
    let cleanBase64 = base64Part.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const mod = cleanBase64.length % 4;
    if (mod === 1) {
      // Invalid trailing single base64 char
      cleanBase64 = cleanBase64.slice(0, -1);
    } else if (mod === 2) {
      cleanBase64 += '==';
    } else if (mod === 3) {
      cleanBase64 += '=';
    }

    const binaryStr = atob(cleanBase64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return { bytes, mime };
  } catch (err) {
    console.error('Failed to decode data URL:', err);
    return null;
  }
}

/**
 * Validates that binary bytes look like a complete PDF file (%PDF- header and %%EOF trailer).
 */
export function validatePdfBytes(bytes: Uint8Array): { valid: boolean; reason?: string } {
  if (!bytes || bytes.length < 16) {
    return { valid: false, reason: 'File is empty or too small to be a valid PDF.' };
  }

  // %PDF- may appear within the first 1024 bytes per PDF specification
  const headerLen = Math.min(bytes.length, 1024);
  let headerStr = '';
  for (let i = 0; i < headerLen; i++) {
    headerStr += String.fromCharCode(bytes[i]);
  }
  if (!headerStr.includes('%PDF-')) {
    return { valid: false, reason: 'Missing %PDF- header. File is not a valid PDF.' };
  }

  // Check for %%EOF near the end of the file (within last 2048 bytes)
  const tailStart = Math.max(0, bytes.length - 2048);
  let tailStr = '';
  for (let i = tailStart; i < bytes.length; i++) {
    tailStr += String.fromCharCode(bytes[i]);
  }
  if (!tailStr.includes('%%EOF')) {
    return {
      valid: false,
      reason: 'This PDF appears incomplete or truncated (missing %%EOF trailer). If it was uploaded earlier, please delete and re-upload it.',
    };
  }

  return { valid: true };
}

/**
 * Converts a data URL into a browser Blob URL.
 */
export function dataUrlToBlobUrl(dataUrl: string, fallbackMime = 'application/pdf'): string {
  const parsed = parseDataUrlToBytes(dataUrl, fallbackMime);
  if (!parsed) return '';
  const blob = new Blob([parsed.bytes.slice().buffer], { type: parsed.mime || fallbackMime });
  return URL.createObjectURL(blob);
}

/**
 * Ensures the downloaded PDF filename ends with .pdf cleanly.
 */
export function ensurePdfFileName(fileName?: string, fallback = 'Document.pdf'): string {
  const base = (fileName || '').trim() || fallback;
  const sanitized = base.replace(/[\\/:*?"<>|]+/g, '_');
  if (/\.pdf$/i.test(sanitized)) return sanitized;
  return `${sanitized}.pdf`;
}

/**
 * Downloads a data URL safely using a Blob URL so large PDFs never fail or corrupt on download.
 */
export function downloadDataUrlFile(
  filename: string,
  dataUrl: string,
  fallbackMime = 'application/pdf'
): { ok: boolean; error?: string } {
  const parsed = parseDataUrlToBytes(dataUrl, fallbackMime);
  if (!parsed) {
    return { ok: false, error: 'Unable to decode file data for download.' };
  }

  const effectiveMime =
    fallbackMime === 'application/pdf' || /\.pdf$/i.test(filename)
      ? 'application/pdf'
      : parsed.mime || fallbackMime;

  if (effectiveMime === 'application/pdf') {
    const check = validatePdfBytes(parsed.bytes);
    if (!check.valid) {
      return { ok: false, error: check.reason || 'Corrupted PDF data.' };
    }
  }

  const blob = new Blob([parsed.bytes.slice().buffer], { type: effectiveMime });
  const blobUrl = URL.createObjectURL(blob);
  const finalName = effectiveMime === 'application/pdf' ? ensurePdfFileName(filename) : filename;

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = finalName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 15000);

  return { ok: true };
}
