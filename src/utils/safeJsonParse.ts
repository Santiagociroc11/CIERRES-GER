/**
 * Safely parses a JSON string, returning a default value if parsing fails
 * @param jsonString - The JSON string to parse
 * @param defaultValue - The default value to return if parsing fails (defaults to empty array)
 * @returns The parsed JSON or the default value
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, defaultValue: T = [] as T): T {
  if (!jsonString || typeof jsonString !== 'string' || jsonString.trim() === '') {
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
  if (Array.isArray(result)) {
    return result as T[];
  }
  return [];
}

/**
 * Safely parses a JSON string that should be an object, returning an empty object if parsing fails
 * @param jsonString - The JSON string to parse
 * @returns The parsed object or an empty object
 */
export function safeJsonParseObject<T>(jsonString: string | null | undefined): T {
  const result = safeJsonParse<T>(jsonString, {} as T);
  if (typeof result === 'object' && result !== null) {
    return result as T;
  }
  return {} as T;
}

/**
 * Safely parses a JSON string that should be a ReglaHistorial array
 * This is a specific function to avoid type casting issues
 * @param jsonString - The JSON string to parse
 * @returns The parsed ReglaHistorial array or an empty array
 */
export function safeJsonParseReglaHistorial(jsonString: string | null | undefined): any[] {
  const result = safeJsonParse<any[]>(jsonString, []);
  if (Array.isArray(result)) {
    return result;
  }
  return [];
}
