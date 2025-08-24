/**
 * Safely trims a string, returning empty string if the value is not a string
 * @param value - The value to trim
 * @returns The trimmed string or empty string if not a string
 */
export function safeTrim(value: any): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
}

/**
 * Safely checks if a string is empty after trimming
 * @param value - The value to check
 * @returns True if the value is empty or not a string
 */
export function safeIsEmpty(value: any): boolean {
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  return true;
}

/**
 * Safely converts a value to string and trims it
 * @param value - The value to convert and trim
 * @returns The trimmed string representation
 */
export function safeToString(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

/**
 * Safely gets a string value with fallback
 * @param value - The value to get
 * @param fallback - The fallback value if the original is not a valid string
 * @returns The string value or fallback
 */
export function safeGetString(value: any, fallback: string = ''): string {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  return fallback;
}
