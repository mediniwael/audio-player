// Extract the filename from a full path. Works with both `/` and `\`
// separators, so it handles Windows and POSIX paths uniformly.
export function basename(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] ?? filePath;
}

// Format a duration in seconds as `M:SS` or `H:MM:SS`. Returns `--:--`
// for null, NaN, or negative values.
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !isFinite(seconds) || seconds <= 0) return '--:--';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}