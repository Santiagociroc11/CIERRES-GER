// Tipos para Evolution API
export type EvolutionConnectionStatus = 
  | 'open'           // Conectado y funcionando
  | 'connecting'     // En proceso de conexión
  | 'close'          // Cerrado/Desconectado
  | 'disconnected'   // Desconectado
  | 'qr'             // Esperando escanear QR
  | 'loading'        // Cargando/Inicializando
  | 'timeout'        // Timeout de conexión
  | 'authFailure'    // Fallo de autenticación
  | 'clientDestroyed' // Cliente destruido
  | 'unknown';       // Estado desconocido

export type WhatsAppDisplayStatus = 
  | 'Conectado'
  | 'Conectando' 
  | 'Esperando Escaneo'
  | 'Desconectado'
  | 'Esperando QR'
  | 'Inicializando'
  | 'Error de Conexión'
  | 'Error de Autenticación'
  | 'Cliente Destruido'
  | 'Estado Desconocido'
  | 'Sin Configurar'
  | 'Error de Verificación';

export interface EvolutionStatusConfig {
  displayText: WhatsAppDisplayStatus;
  color: string;
  bgColor: string;
  icon: string;
  description: string;
  isStable: boolean; // Si es un estado estable o transitorio
}

export const EVOLUTION_STATUS_MAP: Record<EvolutionConnectionStatus, EvolutionStatusConfig> = {
  open: {
    displayText: 'Conectado',
    color: 'text-green-800',
    bgColor: 'bg-green-100',
    icon: '✅',
    description: 'WhatsApp conectado y funcionando',
    isStable: true
  },
  connecting: {
    displayText: 'Esperando Escaneo',
    color: 'text-blue-800', 
    bgColor: 'bg-blue-100',
    icon: '📱',
    description: 'Esperando que escanees el código QR',
    isStable: false
  },
  close: {
    displayText: 'Desconectado',
    color: 'text-red-800',
    bgColor: 'bg-red-100', 
    icon: '❌',
    description: 'WhatsApp desconectado',
    isStable: true
  },
  disconnected: {
    displayText: 'Desconectado',
    color: 'text-red-800',
    bgColor: 'bg-red-100',
    icon: '❌', 
    description: 'WhatsApp desconectado',
    isStable: true
  },
  qr: {
    displayText: 'Esperando QR',
    color: 'text-blue-800',
    bgColor: 'bg-blue-100',
    icon: '📱',
    description: 'Escanea el código QR para conectar',
    isStable: false
  },
  loading: {
    displayText: 'Inicializando',
    color: 'text-purple-800',
    bgColor: 'bg-purple-100', 
    icon: '⏳',
    description: 'Inicializando instancia de WhatsApp',
    isStable: false
  },
  timeout: {
    displayText: 'Error de Conexión',
    color: 'text-orange-800',
    bgColor: 'bg-orange-100',
    icon: '⏰',
    description: 'Timeout en la conexión',
    isStable: true
  },
  authFailure: {
    displayText: 'Error de Autenticación',
    color: 'text-red-800',
    bgColor: 'bg-red-100',
    icon: '🚫',
    description: 'Error de autenticación con WhatsApp',
    isStable: true
  },
  clientDestroyed: {
    displayText: 'Cliente Destruido',
    color: 'text-gray-800',
    bgColor: 'bg-gray-100',
    icon: '💀',
    description: 'Cliente WhatsApp destruido',
    isStable: true
  },
  unknown: {
    displayText: 'Estado Desconocido',
    color: 'text-gray-800',
    bgColor: 'bg-gray-100',
    icon: '❓',
    description: 'Estado desconocido o no reconocido',
    isStable: true
  }
};

// ✅ NUEVOS ESTADOS PARA CASOS ESPECIALES
export const SPECIAL_STATUS_CONFIG: Record<string, EvolutionStatusConfig> = {
  'Sin Configurar': {
    displayText: 'Sin Configurar',
    color: 'text-gray-800',
    bgColor: 'bg-gray-100',
    icon: '⚙️',
    description: 'WhatsApp no está configurado para este asesor',
    isStable: true
  },
  'Error de Verificación': {
    displayText: 'Error de Verificación',
    color: 'text-red-800',
    bgColor: 'bg-red-100',
    icon: '🔍',
    description: 'Error al verificar el estado de WhatsApp',
    isStable: true
  }
};

/**
 * Helper para obtener la configuración de estado de Evolution API
 */
export function getEvolutionStatusConfig(status: string | undefined): EvolutionStatusConfig {
  const normalizedStatus = (status || 'unknown').toLowerCase() as EvolutionConnectionStatus;
  return EVOLUTION_STATUS_MAP[normalizedStatus] || EVOLUTION_STATUS_MAP.unknown;
}

/**
 * Helper para obtener configuración de estados especiales
 */
export function getSpecialStatusConfig(displayText: string): EvolutionStatusConfig | null {
  return SPECIAL_STATUS_CONFIG[displayText] || null;
}

/**
 * Helper para determinar si una instancia está disponible para enviar mensajes
 */
export function isInstanceAvailable(status: string | undefined): boolean {
  return status === 'open';
}

/**
 * Helper para determinar si debemos mostrar QR
 */
export function shouldShowQR(status: string | undefined): boolean {
  return status === 'qr' || status === 'connecting';
}

/**
 * Helper para determinar si el estado es transitorio (necesita polling)
 */
export function isTransitoryStatus(status: string | undefined): boolean {
  const config = getEvolutionStatusConfig(status);
  return !config.isStable;
}
