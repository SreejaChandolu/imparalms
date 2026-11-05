/**
 * Utility to combine conditional class names cleanly
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
  }
  return `${pad(minutes)}:${pad(remainingSeconds)}`;
}

const TITLE_REGEX = /^(prof|professor|dr|doctor|mr|mrs|ms|mx|rev|reverend|sir|lady)\.?$/i;

/**
 * Derives the first name and avatar initial from a full name,
 * ignoring honorific titles such as Prof., Dr., Mr., Ms., Mrs., etc.
 * Example: "Prof. Sarah Connor" -> firstName: "Sarah", initial: "S"
 * Example: "Dr. Marcus Aurelius" -> firstName: "Marcus", initial: "M"
 */
export function getFirstNameAndInitial(
  fullName: string | null | undefined,
  fallbackName = "User"
): { firstName: string; initial: string } {
  if (!fullName || !fullName.trim()) {
    const fallback = fallbackName.trim() || "User";
    const cleanFallback = fallback.charAt(0).toUpperCase() + fallback.slice(1);
    return {
      firstName: cleanFallback,
      initial: cleanFallback.charAt(0).toUpperCase() || "U",
    };
  }

  // Split by whitespace
  const tokens = fullName.trim().split(/\s+/);

  // Find the first token that is not an honorific title
  let actualFirstName = tokens.find((token) => !TITLE_REGEX.test(token));

  // If every token was filtered out as a title (edge case), use the last token
  if (!actualFirstName) {
    actualFirstName = tokens[tokens.length - 1];
  }

  // Strip non-alphanumeric punctuation
  const cleanedName = actualFirstName.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "") || actualFirstName;

  // Capitalize first letter
  const formattedFirstName =
    cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);

  const initial = formattedFirstName.charAt(0).toUpperCase() || "U";

  return {
    firstName: formattedFirstName,
    initial,
  };
}

export function getFirstName(fullName: string | null | undefined, fallbackName = "User"): string {
  return getFirstNameAndInitial(fullName, fallbackName).firstName;
}

export function getNameInitial(fullName: string | null | undefined, fallbackName = "User"): string {
  return getFirstNameAndInitial(fullName, fallbackName).initial;
}
