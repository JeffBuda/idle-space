// src/utils/time.ts

/**
 * Calculates the time delta in seconds between two UNIX timestamps.
 * Returns 0 if the current timestamp is before the last timestamp.
 *
 * @param lastTimestamp - The previous UNIX timestamp (in milliseconds)
 * @param currentTimestamp - The current UNIX timestamp (in milliseconds)
 * @returns The elapsed time in seconds (minimum 0)
 */
export const calculateElapsedSeconds = (
  lastTimestamp: number,
  currentTimestamp: number,
): number => {
  return Math.max(0, Math.floor((currentTimestamp - lastTimestamp) / 1000));
};

/**
 * Formats a duration in seconds into a human-readable "Dd Hh Mm Ss" string.
 * Omits zero-value components, except for seconds which are always shown.
 *
 * @param totalSeconds - The total elapsed seconds to format
 * @returns A formatted string like "2d 3h 15m 45s"
 */
export const formatElapsedTime = (totalSeconds: number): string => {
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
};