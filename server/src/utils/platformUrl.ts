/**
 * Utilidad para obtener la URL de la plataforma desde variables de entorno
 * 
 * Prioridad:
 * 1. PLATFORM_URL (variable específica para la plataforma)
 * 2. PUBLIC_URL (variable genérica de URL pública)
 * 3. Fallback a URL por defecto (solo para desarrollo)
 */

export function getPlatformUrl(): string {
  // Prioridad 1: PLATFORM_URL (variable específica)
  if (process.env.PLATFORM_URL) {
    return process.env.PLATFORM_URL;
  }
  
  // Prioridad 2: PUBLIC_URL (variable genérica)
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL;
  }
  
  // Fallback para desarrollo (solo si no hay variables configuradas)
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ [PlatformUrl] No se encontró PLATFORM_URL ni PUBLIC_URL, usando URL por defecto');
    return 'https://sistema-cierres-ger.automscc.com';
  }
  
  // En producción, si no hay URL configurada, lanzar error
  throw new Error('❌ PLATFORM_URL o PUBLIC_URL debe estar configurada en las variables de entorno');
}
