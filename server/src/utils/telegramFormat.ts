/**
 * Utilidades para formatear mensajes de Telegram
 * 
 * Telegram soporta HTML y Markdown, pero telegramQueueService usa HTML.
 * Estas funciones ayudan a formatear correctamente los mensajes.
 */

/**
 * Escapa caracteres especiales de HTML para Telegram
 * Telegram HTML solo soporta: <b>, <i>, <u>, <s>, <a>, <code>, <pre>
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Convierte texto Markdown simple a HTML de Telegram
 * Convierte *texto* a <b>texto</b>
 */
export function markdownToHtml(text: string): string {
  // Escapar primero los caracteres HTML
  let html = escapeHtml(text);
  
  // Convertir negritas: *texto* -> <b>texto</b>
  // Usar regex no-greedy para evitar problemas con múltiples negritas
  html = html.replace(/\*([^*]+)\*/g, '<b>$1</b>');
  
  // Convertir cursivas: _texto_ -> <i>texto</i>
  html = html.replace(/_([^_]+)_/g, '<i>$1</i>');
  
  // Convertir código: `texto` -> <code>texto</code>
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  return html;
}
