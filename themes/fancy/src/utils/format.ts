// Formatting utilities

/**
 * Format a count into a compact string.
 * Under 1000: show as-is (e.g., "961")
 * 1000+: show with one decimal and k suffix (e.g., "1.1k", "25.1k")
 * Trailing .0 is removed (e.g., 1000 -> "1k", not "1.0k")
 */
export function formatCount(count: number): string {
  if (count < 1000) {
    return String(count);
  }
  const k = count / 1000;
  const formatted = k.toFixed(1);
  // Remove trailing .0
  return formatted.endsWith('.0')
    ? formatted.slice(0, -2) + 'k'
    : formatted + 'k';
}

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
