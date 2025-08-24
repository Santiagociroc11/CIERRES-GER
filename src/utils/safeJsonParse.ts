/**
 * Safely parses a JSON string, returning a default value if parsing fails
 * @param jsonString - The JSON string to parse
 * @param defaultValue - The default value to return if parsing fails (defaults to empty array)
 * @returns The parsed JSON or the default value
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, defaultValue: T = [] as T): T {
  if (!jsonString || jsonString.trim() === '') {
    return defaultValue;
  }
  
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.warn('Failed to parse JSON string:', jsonString, 'Error:', error);
    return defaultValue;
  }
}

/**
 * Safely parses a JSON string that should be an array, returning an empty array if parsing fails
 * @param jsonString - The JSON string to parse
 * @returns The parsed array or an empty array
 */
export function safeJsonParseArray<T>(jsonString: string | null | undefined): T[] {
  const result = safeJsonParse<T[]>(jsonString, []);
  return Array.isArray(result) ? (result as T[]) : [];
}

/**
 * Safely parses a JSON string that should be an object, returning an empty object if parsing fails
 * @param jsonString - The JSON string to parse
 * @returns The parsed object or an empty object
 */
export function safeJsonParseObject<T>(jsonString: string | null | undefined): T {
  const result = safeJsonParse<T>(jsonString, {} as T);
  return typeof result === 'object' && result !== null ? result : {} as T;
}
