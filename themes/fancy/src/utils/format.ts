// Formatting utilities

/**
 * Format bytes into human-readable size string.
 * @param bytes File size in bytes
 * @returns Formatted string like "9.3 MB" or "1.2 GB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return bytes + ' B';
  }
  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  }
  if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}
