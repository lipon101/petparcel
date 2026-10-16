// Browser-side helpers for the admin media flow. Kept out of the components so
// the pure parts are unit-testable and the components own only state + network.

/** Read a File as base64 (no `data:` prefix), which is what the server's
 *  `admin.optimizeMedia` expects. Rejects when the file cannot be read. */
export function readFileAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file couldn't be read."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      if (comma < 0) {
        reject(new Error("That file couldn't be read."));
        return;
      }
      resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

/** A rough, honest estimate of the base64 payload size, used to warn BEFORE a
 *  huge file is posted. base64 inflates by ~4/3 plus a little padding. */
export function estimatedBase64Bytes(fileBytes: number): number {
  return Math.ceil(fileBytes / 3) * 4;
}

/** The server refuses a payload over 52 MB of decoded bytes; this is the same
 *  ceiling expressed for a client-side pre-check on the FILE size. */
export const CLIENT_MAX_UPLOAD_BYTES = 39 * 1024 * 1024;

export function isTooLargeToUpload(fileBytes: number): boolean {
  return fileBytes > CLIENT_MAX_UPLOAD_BYTES;
}
