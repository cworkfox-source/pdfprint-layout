/**
 * Browser file download utilities for exporting PDF, projects, and templates.
 * Handles blob creation, URL generation, and cleanup per §20 privacy constraints.
 */

/**
 * Download binary data as a file to the user's local machine.
 * @param {Uint8Array|ArrayBuffer} data - Binary data to download
 * @param {string} filename - Filename for the downloaded file
 * @param {string} [mimeType='application/octet-stream'] - MIME type
 * @returns {Promise<void>}
 */
export async function downloadBinary(data, filename, mimeType = 'application/octet-stream') {
  if (!data || !filename) {
    throw new Error('downloadBinary requires data and filename');
  }

  const blob = new Blob([data], { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Download a Blob as a file to the user's local machine.
 * Creates a temporary object URL, triggers download, and revokes the URL.
 * @param {Blob} blob - Data to download
 * @param {string} filename - Filename for the downloaded file
 */
export function downloadBlob(blob, filename) {
  if (!blob || !filename) {
    throw new Error('downloadBlob requires blob and filename');
  }

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Download a JSON object as a file.
 * @param {Object} obj - Object to serialize and download
 * @param {string} filename - Filename for the downloaded file
 * @param {number} [indent=2] - JSON indentation spaces
 */
export function downloadJSON(obj, filename, indent = 2) {
  if (!obj || !filename) {
    throw new Error('downloadJSON requires obj and filename');
  }

  const json = JSON.stringify(obj, null, indent);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, filename);
}

/**
 * Download text data as a file.
 * @param {string} text - Text content to download
 * @param {string} filename - Filename for the downloaded file
 * @param {string} [encoding='utf-8'] - Text encoding
 */
export function downloadText(text, filename, encoding = 'utf-8') {
  if (text === undefined || text === null || !filename) {
    throw new Error('downloadText requires text and filename');
  }

  const blob = new Blob([text], { type: `text/plain;charset=${encoding}` });
  downloadBlob(blob, filename);
}
